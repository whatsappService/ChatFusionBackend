// src/services/MessageQuotaService.js
"use strict";

const { Transaction, fn, col, Op } = require("sequelize");
const sequelize = require("../config/database");
const MODELS = require("../models/associations");
const { PERIOD, periodKey } = require("../utils/periodUtil");
const BPS = require("./BusinessPackageService");

const {
  UsageCounter,
  BusinessFeature,
  Feature,
  BusinessPackage,
  BusinessPackageFeature,
  BusinessPackagePermission, // not used here, but kept for future wildcard expansion patterns
  UserPermission, // ^
} = MODELS || {};

/* ---------------------- helpers: parse usage cap ---------------------- */
/**
 * Reads a cap number from meta_json:
 *   { usage_cap: { cap: number, period?: "DAY"|"WEEK"|"MONTH"|"YEAR" } }
 * Returns the numeric cap or null if none.
 */
function parseCapFromMeta(meta_json) {
  if (!meta_json) return null;
  let obj = meta_json;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const capNode =
    obj.usage_cap && typeof obj.usage_cap === "object" ? obj.usage_cap : null;
  if (!capNode) return null;
  const cap = Number(capNode.cap);
  return Number.isFinite(cap) && cap >= 0 ? cap : null;
}

/* ---------------------- business & user caps ---------------------- */

/** Business-wide cap (max across sources). */
async function getBusinessCap(businessId, featureCode) {
  const caps = [];

  // 1) BusinessFeatures.meta_json (joined by Feature.code)
  if (BusinessFeature && Feature) {
    const row = await BusinessFeature.findOne({
      where: { business_id: businessId },
      include: [
        {
          model: Feature,
          as: "feature",
          where: { code: featureCode },
          attributes: [],
        },
      ],
      attributes: ["meta_json"],
      raw: true,
    });
    const c = parseCapFromMeta(row?.meta_json);
    if (c != null) caps.push(c);
  }

  // 2) Active packages' BusinessPackageFeatures.meta_json (max)
  if (BusinessPackage && BusinessPackageFeature && Feature) {
    const pkgRows = await BusinessPackage.findAll({
      where: { business_id: businessId, is_active: true },
      include: [
        {
          model: BusinessPackageFeature,
          as: "featureRules",
          required: true,
          include: [
            {
              model: Feature,
              as: "feature",
              where: { code: featureCode },
              attributes: [],
            },
          ],
          attributes: ["meta_json"],
        },
      ],
      attributes: ["id"],
      raw: true,
    });

    // Because of raw: true + include, rows arrive flattened; gather all meta_json values
    for (const r of pkgRows) {
      // If not raw, you'd map (p.featureRules || []). Here we receive multiple rows already.
      const c = parseCapFromMeta(r["featureRules.meta_json"] ?? r.meta_json);
      if (c != null) caps.push(c);
    }
  }

  if (!caps.length) return null;
  return Math.max(...caps);
}

/** Per-user cap via effective access (User overrides win; already merged by your service). */
async function getUserCap(businessId, userId, featureCode) {
  const eff = await BPS.getEffectiveAccessForUser(
    Number(businessId),
    Number(userId)
  );
  const meta = eff?.featuresMap?.[featureCode]?.meta_json ?? null;
  const cap = parseCapFromMeta(meta);
  return cap == null ? null : cap;
}

/* --------------------------- usage reading --------------------------- */

async function getUsage({
  businessId,
  userId = null,
  featureCode,
  when = new Date(),
  period = PERIOD.DAY,
}) {
  const key = periodKey(period, when);
  const where = {
    business_id: businessId,
    user_id: userId ?? null,
    feature_code: featureCode,
    period_key: key,
  };
  const row = await UsageCounter.findOne({ where, raw: true });
  return { key, used: Number(row?.used || 0) };
}

/* ------------------------ consume (with caps) ------------------------ */

async function consume({
  businessId,
  userId,
  featureCode,
  amount = 1,
  period = PERIOD.DAY,
  when = new Date(),
}) {
  const key = periodKey(period, when);

  const [bizCap, userCap] = await Promise.all([
    getBusinessCap(businessId, featureCode),
    getUserCap(businessId, userId, featureCode),
  ]);

  const [bizUsage, userUsage] = await Promise.all([
    getUsage({ businessId, userId: null, featureCode, when, period }),
    getUsage({ businessId, userId, featureCode, when, period }),
  ]);

  if (userCap != null && userUsage.used + amount > userCap) {
    const remaining = Math.max(0, userCap - userUsage.used);
    const e = new Error("UserQuotaExceeded");
    e.code = "UserQuotaExceeded";
    e.details = { allowed: userCap, used: userUsage.used, remaining };
    throw e;
  }
  if (bizCap != null && bizUsage.used + amount > bizCap) {
    const remaining = Math.max(0, bizCap - bizUsage.used);
    const e = new Error("BusinessQuotaExceeded");
    e.code = "BusinessQuotaExceeded";
    e.details = { allowed: bizCap, used: bizUsage.used, remaining };
    throw e;
  }

  // Bump both counters atomically
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      async function upsertAndInc(userIdForRow) {
        const where = {
          business_id: businessId,
          user_id: userIdForRow,
          feature_code: featureCode,
          period_key: key,
        };

        // Use findOrCreate, then lock row and re-check inside txn
        const [row] = await UsageCounter.findOrCreate({
          where,
          defaults: { ...where, used: 0 },
          transaction: t,
        });

        await row.reload({ transaction: t, lock: t.LOCK.UPDATE });

        // Final safety checks inside txn
        if (
          userIdForRow == null &&
          bizCap != null &&
          row.used + amount > bizCap
        ) {
          const remaining = Math.max(0, bizCap - row.used);
          const e = new Error("BusinessQuotaExceeded");
          e.code = "BusinessQuotaExceeded";
          e.details = { allowed: bizCap, used: row.used, remaining };
          throw e;
        }
        if (
          userIdForRow != null &&
          userCap != null &&
          row.used + amount > userCap
        ) {
          const remaining = Math.max(0, userCap - row.used);
          const e = new Error("UserQuotaExceeded");
          e.code = "UserQuotaExceeded";
          e.details = { allowed: userCap, used: row.used, remaining };
          throw e;
        }

        row.used = row.used + amount;
        await row.save({ transaction: t });
        return row.used;
      }

      const newUserUsed = await upsertAndInc(userId);
      const newBizUsed = await upsertAndInc(null);

      return {
        period_key: key,
        user: { used: newUserUsed, cap: userCap },
        business: { used: newBizUsed, cap: bizCap },
      };
    }
  );
}

/* -------------------- business-period breakdown -------------------- */

async function getBusinessBreakdown({
  businessId,
  featureCode,
  when = new Date(),
  period = PERIOD.DAY,
}) {
  const key = periodKey(period, when);

  const [bizCounter, rows] = await Promise.all([
    UsageCounter.findOne({
      where: {
        business_id: businessId,
        user_id: null,
        feature_code: featureCode,
        period_key: key,
      },
      raw: true,
    }),
    UsageCounter.findAll({
      where: {
        business_id: businessId,
        user_id: { [Op.ne]: null },
        feature_code: featureCode,
        period_key: key,
      },
      attributes: ["user_id", "used"],
      raw: true,
    }),
  ]);

  return {
    period_key: key,
    feature: featureCode,
    business_used: Number(bizCounter?.used || 0),
    users: rows.map((r) => ({ user_id: r.user_id, used: Number(r.used || 0) })),
  };
}

module.exports = {
  PERIOD,
  periodKey,
  getUsage,
  getBusinessCap,
  getUserCap,
  consume,
  getBusinessBreakdown,
};
