"use strict";

/**
 * Usage:
 *   requirePermission("analytics.view")
 *   requirePermission(["reports.view", "analytics.view"], { mode: "all" })
 */
module.exports = function requirePermission(required, opts = {}) {
  const list = (Array.isArray(required) ? required : [required]).filter(
    Boolean
  );
  const mode = (opts.mode || "any").toLowerCase(); // "any" | "all"

  return function (req, res, next) {
    try {
      if (!list.length) return next();

      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      if (roles.includes("super-admin")) return next();

      const permSet =
        req?.access?.permSet || new Set(req?.user?.permissions || []);

      // Global wildcard
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
