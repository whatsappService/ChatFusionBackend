"use strict";

/**
 * Usage:
 *   requireFeature("analytics")
 *   requireFeature(["single_messages", "bulk_send"], { mode: "any" })
 *   requireFeature(["users","analytics"], { mode: "all", strict: true })
 */
module.exports = function requireFeature(required, opts = {}) {
  const codes = (Array.isArray(required) ? required : [required]).filter(
    Boolean
  );
  const mode = (opts.mode || "any").toLowerCase(); // "any" | "all"
  const strict = !!opts.strict;

  return function (req, res, next) {
    try {
      if (!codes.length) return next();

      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      if (roles.includes("super-admin")) return next();

      // Feature set hydrated by authMiddleware
      const featureSet =
        req?.access?.featureSet ||
        new Set(
          (req?.user?.featuresList || [])
            .filter((f) => f?.enabled)
            .map((f) => f.code)
        );

      // Optional strict validation against known features (from effective access)
      if (strict) {
        const known =
          Object.keys(req?.ctx?.effectiveAccess?.featuresMap || {}).length > 0
            ? new Set(Object.keys(req.ctx.effectiveAccess.featuresMap))
            : null;
        if (known) {
          const missing = codes.filter((c) => !known.has(c));
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
        const details = Object.fromEntries(codes.map((c) => [c, has(c)]));
        return res.status(403).json({
          error: "FeatureNotEnabled",
          message: "You don't have access to this feature.",
          required: codes,
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
