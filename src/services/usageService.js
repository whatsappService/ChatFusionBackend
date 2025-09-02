// src/services/usageService.js
"use strict";

const { UsageCounter } = require("../models/associations");
const { normalizePeriod, periodKey } = require("../utils/periodUtil");

/* ---------- helpers ---------- */

function toInt(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : def;
}

function httpError(status, message, data = undefined) {
  const err = new Error(message);
  err.status = status;
  if (data !== undefined) err.data = data;
  return err;
}

/**
 * Parse a usage cap from meta_json (object or JSON string).
 * Expected shape:
 *   { usage_cap: { period: "DAY"|"WEEK"|"MONTH"|"YEAR", cap: number } }
 * Returns: { period: "DAY"|"WEEK"|"MONTH"|"YEAR", cap: number } | null
 */
function resolveUsageCap(meta) {
  if (!meta) return null;

  let obj = meta;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || !obj) return null;

  const capNode =
    obj.usage_cap && typeof obj.usage_cap === "object" ? obj.usage_cap : null;

  if (!capNode) return null;

  const cap = toInt(capNode.cap, NaN);
  if (!Number.isFinite(cap) || cap < 0) return null;

  const normalized = normalizePeriod(capNode.period || "DAY").toUpperCase();
  return { period: normalized, cap };
}

/* ---------- core queries ---------- */

/**
 * Get usage for a (business, optional user) + feature + period.
 * Returns: { used: number, key: string }
 */
async function getUsage({
  business_id,
  user_id = null,
  feature_code,
  period = "DAY",
  when = new Date(),
  transaction,
}) {
  const p = (period || "DAY").toString().toUpperCase();
  const key = periodKey(p, when);

  const where = {
    business_id,
    user_id: user_id == null ? null : user_id,
    feature_code,
    period_key: key,
  };

  const row = await UsageCounter.findOne({ where, transaction, raw: true });
  return { used: toInt(row?.used, 0), key };
}

/**
 * Atomically add usage amount (>=1). Also updates a business aggregate row (user_id = NULL).
 * Uses UPDATE-then-INSERT to handle MySQL NULLs in unique indexes correctly.
 * Returns: { key, amount }
 */
async function increment({
  business_id,
  user_id = null,
  feature_code,
  period = "DAY",
  amount = 1,
  when = new Date(),
  transaction,
}) {
  const amt = Math.max(1, toInt(amount, 1));
  const p = (period || "DAY").toString().toUpperCase();
  const key = periodKey(p, when);

  const sequelize = UsageCounter.sequelize;

  const doBump = async (uid) => {
    // 1) Try UPDATE first; (user_id <=> ?) safely matches NULL
    const [res] = await sequelize.query(
      `UPDATE \`UsageCounters\`
         SET used = used + ?, updatedAt = NOW()
       WHERE business_id = ?
         AND feature_code = ?
         AND period_key = ?
         AND (user_id <=> ?)`,
      {
        replacements: [amt, business_id, feature_code, key, uid],
        transaction,
      }
    );

    // 2) If no row updated, INSERT a new one
    if (!res.affectedRows) {
      await sequelize.query(
        `INSERT INTO \`UsageCounters\`
           (business_id, user_id, feature_code, period_key, used, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        {
          replacements: [business_id, uid, feature_code, key, amt],
          transaction,
        }
      );
    }
  };

  await doBump(user_id); // per-user
  await doBump(null); // business aggregate

  return { key, amount: amt };
}

/**
 * Enforce the user’s per-feature caps (from effective meta_json.usage_cap)
 * and consume usage if allowed.
 * - If feature disabled → 403
 * - If capped and would exceed → 429 with details
 * - Else increments usage (user + business aggregate) and returns { ok: true, key, period }
 */
async function checkAndConsume({
  user, // hydrated User instance (required)
  feature_code, // e.g. "single_messages" | "bulk_send"
  amount = 1, // how many units to consume
  when = new Date(),
  transaction,
}) {
  if (!user || !user.id || !user.business_id) {
    throw httpError(401, "Unauthorized user context");
  }
  const business_id = user.business_id;
  const user_id = user.id;

  const { map } = await user.getEffectiveFeatures();
  const eff = map[feature_code];

  if (!eff || eff.enabled !== true) {
    throw httpError(403, "Feature not enabled for this user", {
      feature_code,
    });
  }

  // Determine cap (or unlimited if null)
  const cap = resolveUsageCap(eff.meta_json); // { period, cap } | null
  const period = (cap?.period || "DAY").toString().toUpperCase();

  if (cap && Number.isFinite(cap.cap)) {
    const current = await getUsage({
      business_id,
      user_id,
      feature_code,
      period,
      when,
      transaction,
    });

    const next = toInt(current.used, 0) + Math.max(1, toInt(amount, 1));
    if (next > cap.cap) {
      const remaining = Math.max(0, cap.cap - toInt(current.used, 0));
      throw httpError(429, "Usage cap exceeded for user", {
        feature_code,
        period,
        cap: cap.cap,
        used: current.used,
        remaining,
        requested: amount,
      });
    }
  }

  // Consume usage (records both user row and business aggregate)
  const { key } = await increment({
    business_id,
    user_id,
    feature_code,
    period,
    amount,
    when,
    transaction,
  });

  return { ok: true, key, period };
}

module.exports = {
  resolveUsageCap,
  getUsage,
  increment,
  checkAndConsume,
};
