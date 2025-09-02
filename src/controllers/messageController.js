"use strict";

const messageService = require("../services/messageService");
const MessageQuota = require("../services/MessageQuotaService"); // ✅ enforce + record usage
const { normalizePeriod } = require("../utils/periodUtil");
const User = require("../models/user");

/** Feature code to meter */
const FEATURE_SEND = "bulk_send";

/** Default period key (align with your plan cycle) */
const DEFAULT_PERIOD = "month";

/** Count units for a single send (1 send == 1 unit) */
function unitsForSingle(_recipient, _contents) {
  return 1;
}

/** Count units for bulk (1 unit per recipient we attempt to send to) */
function unitsForBulk(recipientsData) {
  if (!Array.isArray(recipientsData)) return 0;
  // If the shape is { phone, ... }, dedupe by phone to be safe
  const set = new Set(
    recipientsData
      .map((r) => r?.phone || r?.recipient || r?.whatsapp_number || r?.to)
      .filter(Boolean)
  );
  return set.size || recipientsData.length;
}

/** Pre-check if the user/business can spend `units`.
 *  Returns { ok, reason, remainingUser, remainingBiz, period, period_key }
 */
async function canSpend(businessId, userId, units, featureCode, periodName) {
  const period = normalizePeriod(periodName || DEFAULT_PERIOD);

  const [bizCap, userCap, usageUser, usageBiz] = await Promise.all([
    MessageQuota.getBusinessCap(businessId, featureCode),
    MessageQuota.getUserCap(businessId, userId, featureCode),
    MessageQuota.getUsage({ businessId, userId, featureCode, period }),
    MessageQuota.getUsage({ businessId, userId: null, featureCode, period }),
  ]);

  const remainingUser =
    userCap == null ? null : Math.max(0, userCap - usageUser.used);
  const remainingBiz =
    bizCap == null ? null : Math.max(0, bizCap - usageBiz.used);

  // user-level block (if configured)
  if (userCap != null && usageUser.used + units > userCap) {
    return {
      ok: false,
      reason: "UserCapExceeded",
      remainingUser,
      remainingBiz,
      capUser: userCap,
      usedUser: usageUser.used,
      period,
      period_key: usageUser.key,
    };
  }

  // business-level block (if configured)
  if (bizCap != null && usageBiz.used + units > bizCap) {
    return {
      ok: false,
      reason: "BusinessCapExceeded",
      remainingUser,
      remainingBiz,
      capBiz: bizCap,
      usedBiz: usageBiz.used,
      period,
      period_key: usageBiz.key,
    };
  }

  return {
    ok: true,
    remainingUser,
    remainingBiz,
    capUser: userCap,
    capBiz: bizCap,
    usedUser: usageUser.used,
    usedBiz: usageBiz.used,
    period,
    period_key: usageUser.key, // both user/biz share same period key
  };
}

/** Record successful usage for both user + business */
async function recordSuccessUsage(
  businessId,
  userId,
  featureCode,
  period,
  delta
) {
  if (!delta || delta <= 0) return;
  await Promise.all([
    // user-counter
    MessageQuota.recordUsage({
      businessId,
      userId,
      featureCode,
      period,
      delta,
    }),
    // business aggregate counter
    MessageQuota.recordUsage({
      businessId,
      userId: null,
      featureCode,
      period,
      delta,
    }),
  ]);
}

/** POST /api/messages/single */
exports.sendSingleMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let { recipient, contents } = req.body || {};
    if (!recipient)
      return res
        .status(400)
        .json({ success: false, message: "Recipient required" });
    if (!contents)
      return res
        .status(400)
        .json({ success: false, message: "Message required" });

    contents = Array.isArray(contents) ? contents : [contents];
    const files = req.files || [];

    // Hydrate the user instance so usageService can resolve effective features
    const user = await User.findByPk(req.user.id);
    if (!user)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await messageService.sendSingleMessage(
      bizId,
      recipient,
      contents,
      files,
      { user } // ✅ pass hydrated user (no 'period'—cap period lives in meta_json)
    );

    // Normalize success shape
    if (result && result.success === false) {
      return res.status(result.status || 400).json(result);
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    // If usage cap enforcement throws, it should set a status (e.g., 429)
    if (err.status) {
      return res
        .status(err.status)
        .json({ success: false, message: err.message, data: err.data });
    }
    console.error("sendSingleMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

/** POST /api/messages/bulk */
exports.sendBulkMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let { globalMessages, recipientsData } = req.body || {};

    if (typeof globalMessages === "string") {
      try {
        globalMessages = JSON.parse(globalMessages);
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON in globalMessages" });
      }
    }
    if (typeof recipientsData === "string") {
      try {
        recipientsData = JSON.parse(recipientsData);
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON in recipientsData" });
      }
    }
    if (!Array.isArray(recipientsData) || recipientsData.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "recipientsData is required" });
    }

    // Depending on how multer is configured, adjust this if needed
    const globalFiles = req.files?.globalFiles || [];

    // Hydrate user for usage checks
    const user = await User.findByPk(req.user.id);
    if (!user)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await messageService.sendBulkMessage(
      bizId,
      globalMessages,
      recipientsData,
      globalFiles,
      { user } // ✅ pass hydrated user
    );

    if (result && result.success === false) {
      return res.status(result.status || 400).json(result);
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.status) {
      return res
        .status(err.status)
        .json({ success: false, message: err.message, data: err.data });
    }
    console.error("sendBulkMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};
