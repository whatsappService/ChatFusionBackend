// src/services/BusinessPackageService.js
"use strict";

const { Op, fn, col } = require("sequelize");
const sequelize = require("../config/database");
const MODELS = require("../models/associations");

// Destructure with fallback to undefined (we guard gracefully below)
const {
  User,
  Feature,
  Business,
  BusinessFeature,
  UserFeature,
  BusinessPackage,
  BusinessPackageFeature,
  BusinessPackagePermission,
  BusinessUserPackage,
  UserPermission,
} = MODELS || {};

/* --------------------------------- helpers -------------------------------- */

const needModel = (name, m) => {
  if (!m) {
    const e = new Error(
      `Model "${name}" is not exported from ../models/associations. ` +
        `Please add it to your associations index.`
    );
    e.status = 500;
    throw e;
  }
};

const _featureCodeToIdMap = async (t) => {
  if (!Feature) return {};
  const rows = await Feature.findAll({
    attributes: ["id", "code"],
    transaction: t,
  });
  return Object.fromEntries(rows.map((r) => [r.code, r.id]));
};

const _mergeFeatureRule = (current, rule) => {
  const next = current
    ? { ...current }
    : { enabled: false, limit_value: null, meta_json: null, source: "package" };

  next.enabled = !!(next.enabled || rule.enabled);
  if (rule.limit_value != null) {
    const curVal =
      next.limit_value == null ? -Infinity : Number(next.limit_value);
    next.limit_value = Math.max(curVal, Number(rule.limit_value));
  }
  if (next.meta_json == null && rule.meta_json != null)
    next.meta_json = rule.meta_json;
  if (rule.source) next.source = rule.source; // preserve highest-precedence writer
  return next;
};

const CANONICAL_PERMS = [
  "users.read",
  "users.write",
  "users.manage",
  "features.read",
  "features.write",
  "customers.read",
  "customers.write",
  "messages.read",
  "messages.send",
  "templates.read",
  "templates.write",
  "reports.view",
];

async function _getAllSystemPermissions() {
  if (!BusinessPackagePermission) return [...CANONICAL_PERMS];
  const rows = await BusinessPackagePermission.findAll({
    attributes: [[fn("DISTINCT", col("perm")), "perm"]],
    raw: true,
  });
  const fromDb = rows.map((r) => r.perm).filter(Boolean);
  return Array.from(new Set([...fromDb, ...CANONICAL_PERMS]));
}

function _matchesPattern(candidate, pattern) {
  if (pattern === "*" || candidate === "*") return true;
  if (pattern === candidate) return true;
  if (pattern.endsWith(".*")) {
    const pfx = pattern.slice(0, -2);
    return candidate === pfx || candidate.startsWith(pfx + ".");
  }
  return false;
}

function _expandWithWildcards(perms, universe) {
  const out = new Set();
  for (const p of perms) {
    if (p === "*") {
      universe.forEach((u) => out.add(u));
    } else if (p.endsWith(".*")) {
      const pfx = p.slice(0, -2);
      universe.forEach((u) => _matchesPattern(u, p) && out.add(u));
      out.add(pfx);
    } else {
      out.add(p);
    }
  }
  return out;
}

/* ---------------------------------- CRUD ---------------------------------- */

exports.getAllPackages = async (businessId) => {
  needModel("BusinessPackage", BusinessPackage);
  needModel("BusinessPackageFeature", BusinessPackageFeature);
  needModel("BusinessPackagePermission", BusinessPackagePermission);
  needModel("Feature", Feature);

  return BusinessPackage.findAll({
    where: { business_id: businessId },
    include: [
      {
        model: BusinessPackageFeature,
        as: "featureRules",
        include: [
          { model: Feature, as: "feature", attributes: ["id", "code", "name"] },
        ],
      },
      { model: BusinessPackagePermission, as: "permissions" },
    ],
    order: [["id", "ASC"]],
  });
};

exports.getPackageById = async (businessId, packageId) => {
  needModel("BusinessPackage", BusinessPackage);
  needModel("BusinessPackageFeature", BusinessPackageFeature);
  needModel("BusinessPackagePermission", BusinessPackagePermission);
  needModel("Feature", Feature);

  return BusinessPackage.findOne({
    where: { id: packageId, business_id: businessId },
    include: [
      {
        model: BusinessPackageFeature,
        as: "featureRules",
        include: [
          { model: Feature, as: "feature", attributes: ["id", "code", "name"] },
        ],
      },
      { model: BusinessPackagePermission, as: "permissions" },
    ],
  });
};

exports.createPackage = async (businessId, data) => {
  needModel("Business", Business);
  needModel("BusinessPackage", BusinessPackage);
  needModel("BusinessPackageFeature", BusinessPackageFeature);
  needModel("BusinessPackagePermission", BusinessPackagePermission);
  needModel("Feature", Feature);

  return sequelize.transaction(async (t) => {
    const b = await Business.findByPk(businessId, { transaction: t });
    if (!b) throw new Error("Business not found");

    const { name, description = null, is_active = true } = data || {};
    if (!name) throw new Error("Package name is required");

    const exists = await BusinessPackage.findOne({
      where: { business_id: businessId, name },
      transaction: t,
    });
    if (exists)
      throw new Error(
        "A package with this name already exists in the business"
      );

    const pkg = await BusinessPackage.create(
      {
        business_id: businessId,
        name,
        description,
        is_system: false,
        is_active,
      },
      { transaction: t }
    );

    // features
    if (Array.isArray(data?.features) && data.features.length) {
      const map = await _featureCodeToIdMap(t);
      const rows = data.features
        .map((f) => {
          const fid = map[f.code];
          if (!fid) return null;
          return {
            package_id: pkg.id,
            feature_id: fid,
            enabled: !!f.enabled,
            limit_value: f.limit_value ?? null,
            meta_json: f.meta_json ?? null,
          };
        })
        .filter(Boolean);
      if (rows.length)
        await BusinessPackageFeature.bulkCreate(rows, { transaction: t });
    }

    // permissions
    if (Array.isArray(data?.permissions) && data.permissions.length) {
      const rows = data.permissions
        .filter((p) => typeof p === "string" && p.trim())
        .map((perm) => ({ package_id: pkg.id, perm: perm.trim() }));
      if (rows.length)
        await BusinessPackagePermission.bulkCreate(rows, { transaction: t });
    }

    return exports.getPackageById(businessId, pkg.id);
  });
};

exports.updatePackage = async (businessId, packageId, data) => {
  needModel("BusinessPackage", BusinessPackage);
  needModel("BusinessPackageFeature", BusinessPackageFeature);
  needModel("BusinessPackagePermission", BusinessPackagePermission);
  needModel("Feature", Feature);

  return sequelize.transaction(async (t) => {
    const pkg = await BusinessPackage.findOne({
      where: { id: packageId, business_id: businessId },
      transaction: t,
    });
    if (!pkg) throw new Error("Package not found in this business");

    const patch = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.is_active !== undefined) patch.is_active = !!data.is_active;

    if (Object.keys(patch).length) {
      if (patch.name) {
        const exists = await BusinessPackage.findOne({
          where: { business_id: businessId, name: patch.name },
          transaction: t,
        });
        if (exists && exists.id !== pkg.id) {
          throw new Error(
            "A package with this name already exists in the business"
          );
        }
      }
      await pkg.update(patch, { transaction: t });
    }

    // replace feature rules
    if (Array.isArray(data?.features)) {
      await BusinessPackageFeature.destroy({
        where: { package_id: pkg.id },
        transaction: t,
      });
      if (data.features.length) {
        const map = await _featureCodeToIdMap(t);
        const rows = data.features
          .map((f) => {
            const fid = map[f.code];
            if (!fid) return null;
            return {
              package_id: pkg.id,
              feature_id: fid,
              enabled: !!f.enabled,
              limit_value: f.limit_value ?? null,
              meta_json: f.meta_json ?? null,
            };
          })
          .filter(Boolean);
        if (rows.length)
          await BusinessPackageFeature.bulkCreate(rows, { transaction: t });
      }
    }

    // replace permissions
    if (Array.isArray(data?.permissions)) {
      await BusinessPackagePermission.destroy({
        where: { package_id: pkg.id },
        transaction: t,
      });
      const rows = data.permissions
        .filter((p) => typeof p === "string" && p.trim())
        .map((perm) => ({ package_id: pkg.id, perm: perm.trim() }));
      if (rows.length)
        await BusinessPackagePermission.bulkCreate(rows, { transaction: t });
    }

    return exports.getPackageById(businessId, pkg.id);
  });
};

exports.deletePackage = async (businessId, packageId) => {
  needModel("BusinessPackage", BusinessPackage);
  needModel("BusinessPackageFeature", BusinessPackageFeature);
  needModel("BusinessPackagePermission", BusinessPackagePermission);
  needModel("BusinessUserPackage", BusinessUserPackage);

  return sequelize.transaction(async (t) => {
    const pkg = await BusinessPackage.findOne({
      where: { id: packageId, business_id: businessId },
      transaction: t,
    });
    if (!pkg) throw new Error("Package not found in this business");

    await BusinessPackageFeature.destroy({
      where: { package_id: pkg.id },
      transaction: t,
    });
    await BusinessPackagePermission.destroy({
      where: { package_id: pkg.id },
      transaction: t,
    });
    await BusinessUserPackage.destroy({
      where: { package_id: pkg.id },
      transaction: t,
    });

    await pkg.destroy({ transaction: t });
    return { message: "Package deleted successfully" };
  });
};

/* ------------------------------- assignments ------------------------------- */

exports.assignPackageToUser = async (businessId, userId, packageId) => {
  needModel("User", User);
  needModel("BusinessPackage", BusinessPackage);
  needModel("BusinessUserPackage", BusinessUserPackage);

  return sequelize.transaction(async (t) => {
    const [user, pkg] = await Promise.all([
      User.findOne({
        where: { id: userId, business_id: businessId },
        transaction: t,
      }),
      BusinessPackage.findOne({
        where: { id: packageId, business_id: businessId },
        transaction: t,
      }),
    ]);
    if (!user) throw new Error("User not found in this business");
    if (!pkg) throw new Error("Package not found in this business");

    await BusinessUserPackage.findOrCreate({
      where: { user_id: userId, package_id: packageId },
      defaults: { user_id: userId, package_id: packageId },
      transaction: t,
    });

    return { message: "Package assigned to user" };
  });
};

exports.removePackageFromUser = async (businessId, userId, packageId) => {
  needModel("BusinessPackage", BusinessPackage);
  needModel("BusinessUserPackage", BusinessUserPackage);

  return sequelize.transaction(async (t) => {
    const pkg = await BusinessPackage.findOne({
      where: { id: packageId, business_id: businessId },
      transaction: t,
    });
    if (!pkg) throw new Error("Package not found in this business");

    await BusinessUserPackage.destroy({
      where: { user_id: userId, package_id: packageId },
      transaction: t,
    });
    return { message: "Package unassigned from user" };
  });
};

/* ----------------------------- effective access ---------------------------- */
/**
 * Business acts as an ALLOW-LIST:
 * - A user feature is granted only if BusinessFeature(enabled) contains that code.
 * - We return only user-owned access (no raw business toggles).
 * - Features come from packages and user overrides; user overrides win.
 * - Permissions = (package perms ∪ user ALLOW) − user DENY (wildcards supported).
 *
 * Returns:
 * {
 *   featuresList: [{ code, enabled: true, limit_value, meta_json, source: "package"|"user" }],
 *   featuresMap:  { [code]: { enabled: true, limit_value, meta_json, source } },
 *   permissions:  string[],
 *   roles: [] // kept for compatibility
 * }
 */
exports.getEffectiveAccessForUser = async (businessId, userId) => {
  needModel("User", User);

  const bId = Number(businessId);
  const uId = Number(userId);
  if (!bId || !uId) throw new Error("Missing businessId/userId");

  // Ensure the user is in the business
  const user = await User.findOne({
    where: { id: uId, business_id: bId },
    attributes: ["id", "business_id", "is_active"],
  });
  if (!user)
    return { featuresList: [], featuresMap: {}, permissions: [], roles: [] };

  // ---- 1) BUSINESS allow-list (which feature codes are allowed at all) ----
  let bizAllowed = null; // null => allow all (if no BusinessFeature wired)
  if (BusinessFeature && Feature) {
    const bfRows = await BusinessFeature.findAll({
      where: { business_id: bId, enabled: true },
      include: [{ model: Feature, as: "feature", attributes: ["code"] }],
    });
    bizAllowed = new Set(bfRows.map((r) => r?.feature?.code).filter(Boolean));
  } else if (Feature) {
    // If BusinessFeature isn't wired, default to all known features
    const rows = await Feature.findAll({ attributes: ["code"], raw: true });
    bizAllowed = new Set(rows.map((r) => r.code).filter(Boolean));
  }

  const isAllowed = (code) => {
    if (!code) return false;
    if (bizAllowed == null) return true; // permissive if we can't compute allow-list
    return bizAllowed.has(code);
  };

  // ---- 2) Active packages for this user in THIS business ----
  let activePkgIds = [];
  if (BusinessUserPackage && BusinessPackage) {
    const assignments = await BusinessUserPackage.findAll({
      where: { user_id: uId },
      include: [
        {
          model: BusinessPackage,
          as: "pkg",
          where: { business_id: bId, is_active: true },
          required: true,
          attributes: ["id"],
        },
      ],
      attributes: ["package_id"],
      raw: true,
    });
    activePkgIds = Array.from(
      new Set(assignments.map((r) => r.package_id).filter(Boolean))
    );
  }

  // ---- 3) Build user-owned features (start empty; add only what user gets) ----
  const base = {}; // code -> { enabled, limit_value, meta_json, source }

  // From PACKAGE rules (only if business allows)
  if (activePkgIds.length && BusinessPackageFeature && Feature) {
    const ruleRows = await BusinessPackageFeature.findAll({
      where: { package_id: { [Op.in]: activePkgIds } },
      include: [{ model: Feature, as: "feature", attributes: ["code"] }],
      attributes: ["enabled", "limit_value", "meta_json"],
    });

    for (const r of ruleRows) {
      const code = r?.feature?.code;
      if (!isAllowed(code)) continue;
      base[code] = _mergeFeatureRule(base[code], {
        enabled: !!r.enabled,
        limit_value: r.limit_value,
        meta_json: r.meta_json,
        source: "package",
      });
    }
  }

  // Apply USER overrides (highest precedence; still gated by business)
  if (UserFeature && Feature) {
    const ufRows = await UserFeature.findAll({
      where: { user_id: uId },
      include: [{ model: Feature, as: "feature", attributes: ["code"] }],
      attributes: ["enabled", "limit_value", "meta_json"],
    });

    for (const r of ufRows) {
      const code = r?.feature?.code;
      if (!isAllowed(code)) continue;
      const cur = base[code] || {
        enabled: false,
        limit_value: null,
        meta_json: null,
        source: "package",
      };
      base[code] = {
        enabled: r.enabled != null ? !!r.enabled : !!cur.enabled,
        limit_value: r.limit_value != null ? r.limit_value : cur.limit_value,
        meta_json: r.meta_json != null ? r.meta_json : cur.meta_json,
        source: "user",
      };
    }
  }

  // ---- 4) Permissions = packages ⊕ user ALLOW − user DENY (wildcards supported) ----
  const pkgPerms = new Set();
  if (activePkgIds.length && BusinessPackagePermission) {
    const permRows = await BusinessPackagePermission.findAll({
      where: { package_id: { [Op.in]: activePkgIds } },
      attributes: ["perm"],
      raw: true,
    });
    permRows.forEach((r) => r.perm && pkgPerms.add(r.perm));
  }

  const upRows = UserPermission
    ? await UserPermission.findAll({
        where: { user_id: uId },
        attributes: ["perm", "effect"],
        raw: true,
      })
    : [];

  const allowList = upRows
    .filter((r) => r.effect === "ALLOW")
    .map((r) => r.perm);
  const denyList = upRows.filter((r) => r.effect === "DENY").map((r) => r.perm);

  const universe = await _getAllSystemPermissions();
  const expandedAllow = _expandWithWildcards(
    [...pkgPerms, ...allowList],
    universe
  );
  const expandedDeny = _expandWithWildcards(denyList, universe);

  if (expandedDeny.has("*")) {
    expandedAllow.clear();
  } else {
    for (const d of expandedDeny) {
      for (const p of [...expandedAllow]) {
        if (_matchesPattern(p, d)) expandedAllow.delete(p);
      }
    }
  }

  // ---- 5) Return only what the user actually HAS (enabled + gated) ----
  const featuresList = Object.entries(base)
    .filter(([, v]) => !!v.enabled)
    .map(([code, v]) => ({
      code,
      enabled: true,
      limit_value: v.limit_value ?? null,
      meta_json: v.meta_json ?? null,
      source: v.source === "user" ? "user" : "package",
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const featuresMap = Object.fromEntries(
    featuresList.map((f) => [
      f.code,
      {
        enabled: true,
        limit_value: f.limit_value,
        meta_json: f.meta_json,
        source: f.source,
      },
    ])
  );

  const permissions = Array.from(expandedAllow).sort();

  return { featuresList, featuresMap, permissions, roles: [] };
};

// Backward-compat alias
exports.effectiveAccessForUser = exports.getEffectiveAccessForUser;
