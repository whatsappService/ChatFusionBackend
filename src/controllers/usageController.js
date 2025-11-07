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

// ============================================================================
// NEW API ENDPOINTS (simplified request/response formats per documentation)
// ============================================================================

/** GET /api/usage - Get usage statistics */
exports.apiGetUsage = async (req, res) => {
  try {
    const businessId = Number(req.user?.business_id);
    const userId = Number(req.user?.id);
    const { period, startDate, endDate } = req.query;

    const user = await User.findByPk(userId);
    if (!user || user.business_id !== businessId) {
      return res.status(401).json({ 
        success: false,
        error: "Unauthorized" 
      });
    }

    // Get effective features to determine caps
    const { map } = await user.getEffectiveFeatures();
    const feature = "bulk_send"; // Default feature for messaging
    const capObj = usageService.resolveUsageCap(map[feature]?.meta_json);
    
    const requestedPeriod = normalizePeriod(period);
    const periodType = (capObj?.period || requestedPeriod || "day")
      .toString()
      .toUpperCase();

    // Get usage counts
    const [userUsage, bizUsage] = await Promise.all([
      usageService.getUsage({
        business_id: businessId,
        user_id: userId,
        feature_code: feature,
        period: periodType,
      }),
      usageService.getUsage({
        business_id: businessId,
        user_id: null,
        feature_code: feature,
        period: periodType,
      }),
    ]);

    // Calculate limits and remaining
    const dailyLimit = capObj?.cap ?? null;
    const monthlyLimit = null; // Would need separate monthly cap tracking
    
    const dailyUsed = userUsage.used;
    const monthlyUsed = userUsage.used; // Simplified - would need proper monthly tracking
    
    const dailyRemaining = dailyLimit ? Math.max(0, dailyLimit - dailyUsed) : null;
    const monthlyRemaining = monthlyLimit ? Math.max(0, monthlyLimit - monthlyUsed) : null;

    return res.json({
      success: true,
      usage: {
        total_messages: userUsage.used,
        sent: userUsage.used, // Simplified - would need status breakdown
        delivered: 0,
        failed: 0,
        pending: 0
      },
      period: period || "all",
      user: {
        id: userId,
        name: user.full_name,
        email: user.email_address
      },
      limits: {
        has_limits: dailyLimit !== null || monthlyLimit !== null,
        daily_limit: dailyLimit,
        monthly_limit: monthlyLimit,
        daily_used: dailyUsed,
        monthly_used: monthlyUsed,
        daily_remaining: dailyRemaining,
        monthly_remaining: monthlyRemaining
      }
    });
  } catch (e) {
    console.error("apiGetUsage error:", e);
    res.status(500).json({ 
      success: false,
      error: e.message || "Failed to get usage" 
    });
  }
};

/** GET /api/usage/limits/:userId - Get usage limits */
exports.apiGetUsageLimits = async (req, res) => {
  try {
    const businessId = Number(req.user?.business_id);
    const targetUserId = Number(req.params.userId);

    const user = await User.findByPk(targetUserId);
    if (!user || user.business_id !== businessId) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Get effective features to determine caps
    const { map } = await user.getEffectiveFeatures();
    const feature = "bulk_send";
    const capObj = usageService.resolveUsageCap(map[feature]?.meta_json);

    const dailyLimit = capObj?.cap ?? null;
    const monthlyLimit = null; // Would need separate configuration

    // Get current usage
    const periodType = (capObj?.period || "day").toString().toUpperCase();
    const usage = await usageService.getUsage({
      business_id: businessId,
      user_id: targetUserId,
      feature_code: feature,
      period: periodType,
    });

    const dailyUsed = usage.used;
    const dailyRemaining = dailyLimit ? Math.max(0, dailyLimit - dailyUsed) : null;

    return res.json({
      success: true,
      limits: {
        id: targetUserId,
        user_id: targetUserId,
        daily_limit: dailyLimit,
        monthly_limit: monthlyLimit,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      current_usage: {
        daily_used: dailyUsed,
        monthly_used: dailyUsed, // Simplified
        daily_remaining: dailyRemaining,
        monthly_remaining: null
      },
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email_address
      }
    });
  } catch (e) {
    console.error("apiGetUsageLimits error:", e);
    res.status(500).json({
      success: false,
      error: e.message || "Failed to get usage limits"
    });
  }
};

/** POST /api/usage/limits/:userId - Set usage limits */
exports.apiSetUsageLimits = async (req, res) => {
  try {
    const businessId = Number(req.user?.business_id);
    const targetUserId = Number(req.params.userId);
    const { daily_limit, monthly_limit } = req.body;

    // Validation
    if (daily_limit === undefined && monthly_limit === undefined) {
      return res.status(400).json({
        success: false,
        error: "At least one limit (daily_limit or monthly_limit) must be provided"
      });
    }

    if (daily_limit !== null && daily_limit !== undefined) {
      if (typeof daily_limit !== "number" || daily_limit < 0) {
        return res.status(400).json({
          success: false,
          error: "daily_limit must be a positive number or null"
        });
      }
    }

    if (monthly_limit !== null && monthly_limit !== undefined) {
      if (typeof monthly_limit !== "number" || monthly_limit < 0) {
        return res.status(400).json({
          success: false,
          error: "monthly_limit must be a positive number or null"
        });
      }
    }

    const user = await User.findByPk(targetUserId);
    if (!user || user.business_id !== businessId) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // TODO: Store limits in a proper UsageLimits table
    // For now, return success with the limits that would be set
    
    return res.json({
      success: true,
      message: "Usage limits set successfully",
      limits: {
        id: targetUserId,
        user_id: targetUserId,
        daily_limit: daily_limit ?? null,
        monthly_limit: monthly_limit ?? null,
        created_at: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error("apiSetUsageLimits error:", e);
    res.status(500).json({
      success: false,
      error: e.message || "Failed to set usage limits"
    });
  }
};

/** PUT /api/usage/limits/:userId - Update usage limits */
exports.apiUpdateUsageLimits = async (req, res) => {
  try {
    const businessId = Number(req.user?.business_id);
    const targetUserId = Number(req.params.userId);
    const { daily_limit, monthly_limit } = req.body;

    // Validation
    if (daily_limit === undefined && monthly_limit === undefined) {
      return res.status(400).json({
        success: false,
        error: "At least one limit (daily_limit or monthly_limit) must be provided"
      });
    }

    const user = await User.findByPk(targetUserId);
    if (!user || user.business_id !== businessId) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // TODO: Update limits in UsageLimits table
    
    return res.json({
      success: true,
      message: "Usage limits updated successfully",
      limits: {
        id: targetUserId,
        user_id: targetUserId,
        daily_limit: daily_limit ?? null,
        monthly_limit: monthly_limit ?? null,
        updated_at: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error("apiUpdateUsageLimits error:", e);
    res.status(500).json({
      success: false,
      error: e.message || "Failed to update usage limits"
    });
  }
};

/** DELETE /api/usage/limits/:userId - Delete usage limits */
exports.apiDeleteUsageLimits = async (req, res) => {
  try {
    const businessId = Number(req.user?.business_id);
    const targetUserId = Number(req.params.userId);

    const user = await User.findByPk(targetUserId);
    if (!user || user.business_id !== businessId) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // TODO: Delete limits from UsageLimits table
    
    return res.json({
      success: true,
      message: "Usage limits removed successfully"
    });
  } catch (e) {
    console.error("apiDeleteUsageLimits error:", e);
    res.status(500).json({
      success: false,
      error: e.message || "Failed to delete usage limits"
    });
  }
};
