// src/middleware/requirePermission.js
"use strict";

/**
 * Usage:
 *   requirePermission("reports.view")
 *   requirePermission(["reports.view", "analytics.view"], { mode: "all" })
 * Notes:
 *   Role bypass: "admin" (and legacy: "super-admin", "business-admin")
 */
module.exports = function requirePermission(required, opts = {}) {
  const list = (Array.isArray(required) ? required : [required]).filter(
    Boolean
  );
  const mode = (opts.mode || "any").toLowerCase(); // "any" | "all"

  // Role aliases (back-compat): normalize to 'admin'
  const ROLE_ALIASES = {
    admin: ["super-admin", "business-admin"],
    "super-admin": ["admin"],
    "business-admin": ["admin"],
  };

  const expandRoles = (roles) => {
    const set = new Set();
    for (const r of roles) {
      const key = String(r || "").toLowerCase();
      if (!key) continue;
      set.add(key);
      for (const alias of ROLE_ALIASES[key] || []) set.add(alias);
    }
    return set;
  };

  return function (req, res, next) {
    try {
      if (!list.length) return next();

      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      const roleSet = expandRoles(roles);

      // ✅ Role bypass if admin (or legacy variants)
      if (roleSet.has("admin")) return next();

      const permSet =
        req?.access?.permSet || new Set(req?.user?.permissions || []);

      // ✅ Global wildcard
      if (permSet.has("*")) return next();

      const has = (p) => permSet.has(p);
      const pass = mode === "all" ? list.every(has) : list.some(has);

      if (!pass) {
        return res.status(403).json({
          error: "PermissionDenied",
          message: "You don't have the required permission.",
          required: list,
          mode,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
