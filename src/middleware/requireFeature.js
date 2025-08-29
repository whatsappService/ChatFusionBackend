"use strict";

const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * requireFeature(required, opts?)
 *   - required: string | string[]
 *   - opts.mode: 'any' | 'all'  (default: 'any')
 *   - opts.strict: boolean      (default: false) — if true, 400 if any feature code is unknown
 *
 * Effective policy:
 *   effective = (business_enabled == 1) AND (user_enabled IS NULL OR user_enabled == 1)
 * i.e. business turns it on; users can only turn it off if they have an override.
 */
module.exports = function requireFeature(required, opts = {}) {
  const codes = (Array.isArray(required) ? required : [required]).filter(Boolean);
  const mode = (opts.mode || "any").toLowerCase(); // 'any' | 'all'
  const strict = !!opts.strict;

  return async function (req, res, next) {
    try {
      if (!codes.length) return next();

      const businessId = req.user?.business_id;
      const userId = req.user?.id;
      if (!businessId || !userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const placeholders = codes.map(() => "?").join(",");
      const rows = await sequelize.query(
        `
        SELECT
          f.code,
          CASE
            WHEN COALESCE(bf.enabled, 0) = 1
                 AND COALESCE(uf.enabled, 1) = 1
            THEN 1 ELSE 0
          END AS enabled
        FROM Features f
        LEFT JOIN BusinessFeatures bf
          ON bf.feature_id = f.id AND bf.business_id = ?
        LEFT JOIN UserFeatures uf
          ON uf.feature_id = f.id AND uf.user_id    = ?
        WHERE f.code IN (${placeholders})
        `,
        {
          type: QueryTypes.SELECT,
          replacements: [businessId, userId, ...codes],
        }
      );

      // Optional strictness: ensure every requested code exists in Features
      if (strict) {
        const found = new Set(rows.map((r) => r.code));
        const missing = codes.filter((c) => !found.has(c));
        if (missing.length) {
          return res.status(400).json({
            error: "UnknownFeatureCode",
            missing,
          });
        }
      }

      const enabledSet = new Set(
        rows.filter((r) => Number(r.enabled) === 1).map((r) => r.code)
      );

      const pass =
        mode === "all"
          ? codes.every((c) => enabledSet.has(c))
          : codes.some((c) => enabledSet.has(c));

      if (!pass) {
        const details = {};
        codes.forEach((c) => (details[c] = enabledSet.has(c)));
        return res.status(403).json({
          error: "FeatureNotEnabled",
          message: "You don't have access to this feature.",
          required: codes,
          mode,
          details,
        });
      }

      // Expose resolved bits downstream if useful
      req.featuresResolved = Object.fromEntries(
        codes.map((c) => [c, enabledSet.has(c)])
      );

      next();
    } catch (e) {
      next(e);
    }
  };
};
