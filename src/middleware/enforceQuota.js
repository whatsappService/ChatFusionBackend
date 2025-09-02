"use strict";

const MessageQuota = require("../services/MessageQuotaService");
const { normalizePeriod } = require("../utils/periodUtil");

/**
 * Usage:
 *   router.post(
 *     '/messages/send',
 *     authMiddleware,
 *     enforceQuota('bulk_send', (req) => req.body.recipients?.length || 1, { period: 'day' }),
 *     messagesController.send
 *   )
 */
module.exports = function enforceQuota(
  featureCode,
  amountSelector = () => 1,
  opts = {}
) {
  const period = normalizePeriod(opts.period);

  return async (req, res, next) => {
    try {
      const businessId = Number(req.user?.business_id);
      const userId = Number(req.user?.id);
      if (!businessId || !userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const amount = Math.max(1, Number(amountSelector(req) || 1));

      const result = await MessageQuota.consume({
        businessId,
        userId,
        featureCode,
        amount,
        period,
      });

      req.quota = { featureCode, ...result };
      next();
    } catch (e) {
      if (e.code === "UserQuotaExceeded") {
        return res.status(429).json({
          error: "UserQuotaExceeded",
          message: "User message quota exceeded.",
          details: e.details,
        });
      }
      if (e.code === "BusinessQuotaExceeded") {
        return res.status(429).json({
          error: "BusinessQuotaExceeded",
          message: "Business message quota exceeded.",
          details: e.details,
        });
      }
      next(e);
    }
  };
};
