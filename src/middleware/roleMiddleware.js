"use strict";

/**
 * Simple role guard based on your array-based `req.user.roles`.
 * Allows access if the user has ANY of the listed roles.
 *
 * Usage:
 *   router.post(
 *     "/admin-only",
 *     authMiddleware,
 *     roleMiddleware(["super-admin", "admin"]),
 *     handler
 *   );
 */
module.exports = function roleMiddleware(allowed = []) {
  const required = Array.isArray(allowed) ? allowed : [allowed];

  return (req, res, next) => {
    try {
      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      const ok = required.length === 0 || required.some((r) => roles.includes(r));

      if (!ok) {
        return res.status(403).json({
          error: "AccessDenied",
          message: "You don't have the required role.",
          requiredRoles: required,
          roles,
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
};
