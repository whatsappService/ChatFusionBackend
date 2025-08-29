// src/middleware/requirePermission.js
"use strict";

const { checkPermission } = require("../utils/acl");

/**
 * Usage:
 *   requirePermission("whatsapp.manage")
 *   requirePermission(["analytics.view", "reports.export"])  // OR logic
 *
 * Reads:
 *   - req.user.roles  (array)
 *   - req.ctx.permissionOverrides or req.user.permission_overrides (optional)
 *     shape: { allow?: string[], deny?: string[] }
 */
module.exports = function requirePermission(required) {
  const requiredList = Array.isArray(required) ? required : [required];

  return function (req, res, next) {
    try {
      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];

      // normalize overrides if present
      const overrides =
        req.ctx?.permissionOverrides ?? req.user?.permission_overrides ?? null;

      const pass = requiredList.some((perm) =>
        checkPermission({ roles, overrides }, perm)
      );

      if (!pass) {
        return res.status(403).json({
          error: "PermissionDenied",
          message: "You don't have the required permission.",
          required: requiredList,
          roles,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
