// src/middleware/requireFeature.js
"use strict";

const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const BusinessPackageService = require("../services/BusinessPackageService");

module.exports = function requireFeature(required, opts = {}) {
  const codes = (Array.isArray(required) ? required : [required]).filter(
    Boolean
  );
  const mode = (opts.mode || "any").toLowerCase();
  const strict = !!opts.strict;

  return async function (req, res, next) {
    try {
      if (!codes.length) return next();

      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      if (roles.includes("super-admin")) return next();

      const businessId = Number(
        req.user?.business_id || req.params?.businessId || req.params?.id
      );
      const userId = Number(req.user?.id);
      if (!businessId || !userId)
        return res.status(401).json({ error: "Unauthorized" });

      let featuresMap = req.ctx?.effectiveAccess?.featuresMap;
      if (!featuresMap) {
        const eff = await BusinessPackageService.getEffectiveAccessForUser(
          businessId,
          userId
        );
        req.ctx = req.ctx || {};
        req.ctx.effectiveAccess = eff || { featuresMap: {}, permissions: [] };
        featuresMap = req.ctx.effectiveAccess.featuresMap || {};
      }

      if (strict) {
        const placeholders = codes.map(() => "?").join(",");
        const rows = await sequelize.query(
          `SELECT code FROM \`Features\` WHERE code IN (${placeholders})`,
          { type: QueryTypes.SELECT, replacements: codes }
        );
        const found = new Set(rows.map((r) => r.code));
        const missing = codes.filter((c) => !found.has(c));
        if (missing.length) {
          return res.status(400).json({ error: "UnknownFeatureCode", missing });
        }
      }

      const enabledSet = new Set(
        codes.filter((c) => !!(featuresMap[c] && featuresMap[c].enabled))
      );
      const pass =
        mode === "all"
          ? codes.every((c) => enabledSet.has(c))
          : codes.some((c) => enabledSet.has(c));

      if (!pass) {
        const details = Object.fromEntries(
          codes.map((c) => [c, enabledSet.has(c)])
        );
        return res.status(403).json({
          error: "FeatureNotEnabled",
          message: "You don't have access to this feature.",
          required: codes,
          mode,
          details,
        });
      }

      req.featuresResolved = Object.fromEntries(codes.map((c) => [c, true]));
      next();
    } catch (e) {
      console.error("requireFeature error", {
        path: req.originalUrl,
        userId: req.user?.id,
        businessId: req.user?.business_id || req.params?.businessId,
        message: e?.message,
        sqlMessage: e?.original?.sqlMessage,
        sql: e?.sql,
        stack: e?.stack,
      });
      return res
        .status(500)
        .json({
          error: "FeatureCheckFailed",
          message: e?.message || "Feature gate failed",
        });
    }
  };
};
