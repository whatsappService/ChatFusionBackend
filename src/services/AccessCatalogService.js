// src/services/AccessCatalogService.js
"use strict";

const { fn, col } = require("sequelize");
const MODELS = require("../models/associations");
const { Feature, BusinessFeature, BusinessPackage, BusinessPackagePermission } =
  MODELS || {};

const {
  PERMISSIONS_BY_FEATURE,
  CANONICAL_PERMS,
  FEATURE_PERMISSION_PREFIX,
} = require("../utils/accessCatalog");

const { getEffectiveAccessForUser } = require("./BusinessPackageService");

function uniqSorted(arr) {
  return Array.from(new Set((arr || []).filter(Boolean))).sort();
}

/**
 * Build the access catalog for a business, optionally pre-filled for a user.
 *
 * @param {number|string} businessId
 * @param {{ userId?: number|string }} opts
 */
async function getAccessCatalog(businessId, opts = {}) {
  const bId = Number(businessId);
  const uId = opts.userId ? Number(opts.userId) : null;

  /* ------------------- 0) Load DB distinct permissions up-front ------------------- */
  let dbPerms = [];
  if (BusinessPackagePermission) {
    const rows = await BusinessPackagePermission.findAll({
      attributes: [[fn("DISTINCT", col("perm")), "perm"]],
      raw: true,
    });
    dbPerms = rows.map((r) => r.perm).filter((p) => p && p !== "*");
  }
  const allPermissions = uniqSorted([...CANONICAL_PERMS, ...dbPerms]);

  /* -------------------- 1) Features allowed for this business -------------------- */
  let features = [];
  if (Feature) {
    const all = await Feature.findAll({
      attributes: ["code", "name", "description"],
      raw: true,
    });

    if (BusinessFeature) {
      const bf = await BusinessFeature.findAll({
        where: { business_id: bId, enabled: true },
        attributes: [],
        include: [{ model: Feature, as: "feature", attributes: ["code"] }],
        raw: true,
      });
      const allowed = new Set(bf.map((r) => r["feature.code"]).filter(Boolean));
      features = allowed.size ? all.filter((f) => allowed.has(f.code)) : all;
    } else {
      features = all;
    }
  }

  const shapedFeatures = features
    .map((f) => ({
      code: f.code,
      name: f.name || f.code,
      description: f.description || null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  /* ----------- 2) permissionsByFeature (canonical + DB, filtered by prefixes) ----------- */
  const featureCodes = new Set(shapedFeatures.map((f) => f.code));
  const permissionsByFeature = {};

  for (const code of featureCodes) {
    const base = new Set(PERMISSIONS_BY_FEATURE[code] || []);
    const pfxs = FEATURE_PERMISSION_PREFIX[code] || [code];

    // include DB perms that match any prefix for this feature
    for (const p of dbPerms) {
      if (pfxs.some((pfx) => p === pfx || p.startsWith(pfx + "."))) {
        base.add(p);
      }
    }

    permissionsByFeature[code] = Array.from(base).sort();
  }

  /* -------------------------- 3) business packages list -------------------------- */
  let packages = [];
  if (BusinessPackage) {
    packages = await BusinessPackage.findAll({
      where: { business_id: bId },
      attributes: ["id", "name", "is_active"],
      order: [["name", "ASC"]],
      raw: true,
    });
  }

  /* -------------------- 4) optional user pre-fill (feature/perm/pkg) -------------------- */
  let selected;
  if (uId) {
    try {
      const eff = await getEffectiveAccessForUser(bId, uId);
      selected = {
        featureCodes: Array.isArray(eff?.featuresList)
          ? eff.featuresList.map((f) => f.code)
          : [],
        permissions: Array.isArray(eff?.permissions) ? eff.permissions : [],
        package: eff?.package || { id: null, name: null, is_custom: true },
        package_name: eff?.package_name ?? eff?.package?.name ?? "Custom",
        is_custom: !!eff?.is_custom,
      };
    } catch {
      // ignore; selected stays undefined if fetch fails
    }
  }

  return {
    features: shapedFeatures,
    permissionsByFeature,
    allPermissions,
    packages,
    ...(selected ? { selected } : {}),
  };
}

module.exports = { getAccessCatalog };
