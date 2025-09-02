// src/controllers/usageController.js
"use strict";

const { normalizePeriod, periodKey } = require("../utils/periodUtil");
const usageService = require("../services/usageService");
const { UsageCounter, User } = require("../models/associations");
const { Op, fn, col, literal } = require("sequelize");

/** GET /api/usage/my?feature=bulk_send&period=day */
exports.getMyUsage = async (req, res) => {
  try {
    const businessId = Number(req.user?.business_id);
    const userId = Number(req.user?.id);
    const feature = String(req.query?.feature || "bulk_send");

    const user = await User.findByPk(userId);
    if (!user || user.business_id !== businessId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Resolve cap from effective features (meta_json)
    const { map } = await user.getEffectiveFeatures();
    const capObj = usageService.resolveUsageCap(map[feature]?.meta_json);
    const requestedPeriod = normalizePeriod(req.query?.period);
    const period = (capObj?.period || requestedPeriod || "day")
      .toString()
      .toUpperCase();

    const key = periodKey(period, new Date());

    const [u, b] = await Promise.all([
      usageService.getUsage({
        business_id: businessId,
        user_id: userId,
        feature_code: feature,
        period,
      }),
      usageService.getUsage({
        business_id: businessId,
        user_id: null,
        feature_code: feature,
        period,
      }),
    ]);

    const userCap = capObj?.cap ?? null;
    const remainingUser =
      userCap == null ? null : Math.max(0, userCap - u.used);

    // With the new design, there is no business-wide cap (always null)
    res.json({
      feature,
      period,
      period_key: key,
      user: { used: u.used, cap: userCap, remaining: remainingUser },
      business: { used: b.used, cap: null, remaining: null },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to get usage" });
  }
};

/** GET /api/businesses/:businessId/usage?feature=bulk_send&period=day */
exports.getBusinessUsage = async (req, res) => {
  try {
    const businessId = Number(req.params.businessId);
    const feature = String(req.query?.feature || "bulk_send");
    const period = (normalizePeriod(req.query?.period) || "day")
      .toString()
      .toUpperCase();
    const key = periodKey(period, new Date());

    // Aggregate per-user for this business/feature/period_key
    const rows = await UsageCounter.findAll({
      attributes: ["user_id", [fn("SUM", col("used")), "used"]],
      where: {
        business_id: businessId,
        feature_code: feature,
        period_key: key,
      },
      group: ["user_id"],
      raw: true,
    });

    const business_used = rows.reduce((acc, r) => acc + Number(r.used || 0), 0);

    // Enrich user info + their personal caps
    const userIds = rows.map((r) => r.user_id).filter((id) => id != null);
    const users = userIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: userIds } },
          attributes: ["id", "full_name", "email_address", "business_id"],
          raw: true,
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // Fetch caps per user by reading their effective features
    const caps = {};
    for (const uid of userIds) {
      const u = await User.findByPk(uid);
      if (!u || u.business_id !== businessId) {
        caps[uid] = null;
        continue;
      }
      const { map } = await u.getEffectiveFeatures();
      const capObj = usageService.resolveUsageCap(map[feature]?.meta_json);
      caps[uid] = capObj?.cap ?? null;
    }

    const usersEnriched = rows.map((r) => {
      const info = userMap[r.user_id] || {};
      const cap = caps[r.user_id] ?? null;
      const used = Number(r.used || 0);
      return {
        user_id: r.user_id,
        full_name: info.full_name || null,
        email_address: info.email_address || null,
        used,
        cap,
        remaining: cap == null ? null : Math.max(0, cap - used),
      };
    });

    res.json({
      feature,
      period,
      period_key: key,
      business: {
        used: business_used,
        cap: null, // no business-wide cap in the new design
        remaining: null,
      },
      users: usersEnriched,
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to get business usage" });
  }
};
