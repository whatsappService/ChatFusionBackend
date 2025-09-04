"use strict";

/**
 * Simple role guard based on `req.user.roles`.
 * Allows access if the user has ANY of the listed roles.
 *
 * Usage:
 *   router.post("/admin-only", auth, roleMiddleware("admin"), handler);
 *   // Back-compat: routes that still pass ["super-admin","business-admin"]
 *   // will also be satisfied by a user with role "admin".
 */
module.exports = function roleMiddleware(allowed = []) {
  const required = Array.isArray(allowed) ? allowed : [allowed];

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

  const expandRequired = (reqs) => {
    const set = new Set();
    for (const r of reqs) {
      const key = String(r || "").toLowerCase();
      if (!key) continue;
      set.add(key);
      for (const alias of ROLE_ALIASES[key] || []) set.add(alias);
    }
    return set;
  };

  const requiredSet = expandRequired(required);

  return (req, res, next) => {
    try {
      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      const have = expandRoles(roles);

      const ok =
        requiredSet.size === 0 ||
        Array.from(requiredSet).some((r) => have.has(r));

      if (!ok) {
        return res.status(403).json({
          error: "AccessDenied",
          message: "You don't have the required role.",
          requiredRoles: Array.from(required),
          roles,
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
};
