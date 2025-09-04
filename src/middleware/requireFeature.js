"use strict";

/**
 * Usage:
 *   requireFeature("users")
 *   requireFeature(["users", "reports"], { mode: "all" })
 * Notes:
 *   Role bypass: "admin" (and legacy: "super-admin", "business-admin")
 */
module.exports = function requireFeature(required, opts = {}) {
  const raw = (Array.isArray(required) ? required : [required]).filter(Boolean);
  const mode = (opts.mode || "any").toLowerCase(); // "any" | "all"
  const strict = !!opts.strict;

  // Feature code aliases (back-compat)
  const FEATURE_ALIASES = {
    users: ["multi_user"],
    multi_user: ["users"],
    reports: ["analytics"],
    analytics: ["reports"],
    ai_chatbot: ["chatbot"],
    chatbot: ["ai_chatbot"],
  };

  // Role aliases (back-compat): normalize everything to 'admin'
  const ROLE_ALIASES = {
    admin: ["super-admin", "business-admin"],
    "super-admin": ["admin"],
    "business-admin": ["admin"],
  };

  const expandCodes = (codes) =>
    Array.from(
      new Set(codes.flatMap((c) => [c, ...(FEATURE_ALIASES[c] || [])]))
    );

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

  const codes = expandCodes(raw);

  return function (req, res, next) {
    try {
      if (!codes.length) return next();

      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      const roleSet = expandRoles(roles);

      // ✅ Role bypass if admin (or legacy variants)
      if (roleSet.has("admin")) return next();

      // ✅ wildcard permission bypass
      const permSet =
        req?.access?.permSet || new Set(req?.user?.permissions || []);
      if (permSet.has("*")) return next();

      // Features hydrated by auth
      const featureSet =
        req?.access?.featureSet ||
        new Set(
          (req?.user?.featuresList || [])
            .filter((f) => f?.enabled)
            .map((f) => f.code)
        );

      // Optional strict validation against known features
      if (strict) {
        const knownMap = req?.ctx?.effectiveAccess?.featuresMap || null;
        if (knownMap && Object.keys(knownMap).length) {
          const known = new Set(Object.keys(knownMap));
          const missing = raw.filter(
            (c) =>
              !known.has(c) &&
              !(FEATURE_ALIASES[c] || []).some((a) => known.has(a))
          );
          if (missing.length) {
            return res
              .status(400)
              .json({ error: "UnknownFeatureCode", missing });
          }
        }
      }

      const has = (c) => featureSet.has(c);
      const pass = mode === "all" ? codes.every(has) : codes.some(has);

      if (!pass) {
        const details = Object.fromEntries(
          raw.map((c) => {
            const aliases = [c, ...(FEATURE_ALIASES[c] || [])];
            return [c, aliases.some(has)];
          })
        );
        return res.status(403).json({
          error: "FeatureNotEnabled",
          message: "You don't have access to this feature.",
          required: raw,
          mode,
          details,
        });
      }

      next();
    } catch (e) {
      console.error("requireFeature error", {
        path: req.originalUrl,
        userId: req.user?.id,
        businessId: req.user?.business_id || req.params?.businessId,
        message: e?.message,
        stack: e?.stack,
      });
      return res.status(500).json({
        error: "FeatureCheckFailed",
        message: e?.message || "Feature gate failed",
      });
    }
  };
};
