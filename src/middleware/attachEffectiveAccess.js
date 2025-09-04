// src/middleware/attachEffectiveAccess.js
"use strict";

const BusinessPackageService = require("../services/BusinessPackageService");

/**
 * Attaches:
 *   req.ctx.effectiveAccess = { featuresMap, featuresList, permissions }
 *   req.ctx.packagePermissions = Set<string>
 *   req.ability = { hasFeature, hasAnyFeature, hasAllFeatures, can, canAny }
 */
module.exports = async function attachEffectiveAccess(req, res, next) {
  try {
    if (req?.ctx?.effectiveAccess) {
      const { featuresMap = {}, permissions = [] } = req.ctx.effectiveAccess;
      const permSet = new Set(permissions);
      req.ctx.packagePermissions = permSet;
      req.ability = makeAbility(featuresMap, permSet);
      return next();
    }

    const businessId = req.user?.business_id;
    const userId = req.user?.id;
    if (!businessId || !userId)
      return res.status(401).json({ error: "Unauthorized" });

    const eff = await BusinessPackageService.getEffectiveAccessForUser(
      businessId,
      userId
    );
    const permSet = new Set(eff.permissions || []);

    req.ctx = req.ctx || {};
    req.ctx.effectiveAccess = eff;
    req.ctx.packagePermissions = permSet;
    req.ability = makeAbility(eff.featuresMap || {}, permSet);

    next();
  } catch (err) {
    next(err);
  }
};

function makeAbility(featuresMap, packagePermsSet) {
  const hasFeature = (code) => !!featuresMap?.[code]?.enabled;
  const hasAnyFeature = (codes = []) => codes.some((c) => hasFeature(c));
  const hasAllFeatures = (codes = []) => codes.every((c) => hasFeature(c));
  const can = (perm) => packagePermsSet.has(perm);
  const canAny = (perms = []) => perms.some((p) => can(p));
  return { hasFeature, hasAnyFeature, hasAllFeatures, can, canAny };
}
