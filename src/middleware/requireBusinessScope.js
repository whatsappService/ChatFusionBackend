// src/middleware/requireBusinessScope.js
"use strict";

/**
 * Ensures the caller belongs to the same business as the `:businessId` (or :id) route param.
 * Optional bypass by role (defaults to ONLY 'super-admin' to match old behavior).
 *
 * Usage:
 *   router.get("/:businessId/...", auth, requireBusinessScope(), handler)
 *   router.post("/:businessId/...", auth, roleMiddleware(["super-admin","business-admin"]), requireBusinessScope(), handler)
 *
 * Options:
 *   - param: which route param to read (default "businessId"; falls back to "id")
 *   - bypassRoles: roles allowed to cross tenants (default ["super-admin"])
 */
module.exports = function requireBusinessScope(opts = {}) {
  const param = String(opts.param || "businessId");
  const bypassRoles =
    Array.isArray(opts.bypassRoles) && opts.bypassRoles.length
      ? opts.bypassRoles.map((r) => String(r).toLowerCase())
      : ["super-admin"]; // keep old behavior

  // Back-compat role aliases like other middlewares
  const ROLE_ALIASES = {
    admin: ["super-admin", "business-admin"],
    "super-admin": ["admin"],
    "business-admin": ["admin"],
  };

  const expandRoles = (roles) => {
    const out = new Set();
    for (const r of roles || []) {
      const key = String(r || "").toLowerCase();
      if (!key) continue;
      out.add(key);
      for (const alias of ROLE_ALIASES[key] || []) out.add(alias);
    }
    return out;
  };

  const bypassSet = new Set(
    bypassRoles.flatMap((r) => [r, ...(ROLE_ALIASES[r] || [])]).map(String)
  );

  return (req, res, next) => {
    try {
      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      const have = expandRoles(roles);

      // Role-based bypass for chosen roles (default: only super-admin)
      if ([...have].some((r) => bypassSet.has(r))) return next();

      const paramBusinessId = Number(req.params[param] ?? req.params.id);
      if (!paramBusinessId) {
        return res.status(400).json({ error: "InvalidBusinessId" });
      }

      if (Number(req.user?.business_id) === paramBusinessId) return next();

      return res.status(403).json({ error: "AccessDenied" });
    } catch (e) {
      next(e);
    }
  };
};
