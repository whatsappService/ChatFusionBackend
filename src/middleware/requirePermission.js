"use strict";

/**
 * Usage:
 *   requirePermission("messages.send")
 *   requirePermission(["analytics.view", "reports.export"]) // OR logic
 *
 * Reads from attachEffectiveAccess:
 *   - req.ctx.packagePermissions  Set<string>
 */
module.exports = function requirePermission(required) {
  const requiredList = Array.isArray(required) ? required : [required];

  return function (req, res, next) {
    try {
      const packagePerms = req.ctx?.packagePermissions || new Set();
      const pass = requiredList.some((p) => packagePerms.has(p));

      if (!pass) {
        return res.status(403).json({
          error: "PermissionDenied",
          message: "You don't have the required permission.",
          required: requiredList,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
