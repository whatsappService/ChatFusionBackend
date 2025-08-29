// src/middleware/requirePermission.js
"use strict";
const { getUserPermissions, match } = require("../utils/acl");

module.exports = function requirePermission(required) {
  const requiredList = Array.isArray(required) ? required : [required];

  return (req, res, next) => {
    try {
      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      // If you store per-user overrides anywhere (e.g. req.user.permission_overrides), pass them here:
      const { allow, deny } = getUserPermissions(
        roles /*, req.user.permission_overrides*/
      );

      // Deny wins
      const denied = requiredList.some((need) => {
        for (const d of deny) if (match(d, need)) return true;
        return false;
      });
      if (denied) {
        return res
          .status(403)
          .json({ error: "PermissionDenied", reason: "explicit_deny" });
      }

      // ANY required permission allowed
      const pass = requiredList.some((need) => {
        for (const a of allow) if (match(a, need)) return true;
        return false;
      });

      if (!pass) {
        return res.status(403).json({
          error: "PermissionDenied",
          message: "You don't have the required permission.",
          required: requiredList,
          roles,
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
};
