"use strict";

const { Op, fn, col } = require("sequelize");
const sequelize = require("../config/database");
const MODELS = require("../models/associations");

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
    : { enabled: false, meta_json: null, source: "package", name: null };

  next.enabled = !!(next.enabled || rule.enabled);
  if (next.meta_json == null && rule.meta_json != null)
    next.meta_json = rule.meta_json;
  if (!next.name && rule.name) next.name = rule.name;
  if (rule.source) next.source = rule.source;
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

async function _getAllSystemPermissions(businessId) {
  if (!BusinessPackagePermission || !BusinessPackage)
    return [...CANONICAL_PERMS];
  if (!businessId) return [...CANONICAL_PERMS];

  const rows = await BusinessPackagePermission.findAll({
    include: [
      {
        model: BusinessPackage,
        as: "pkg",
        where: { business_id: businessId },
        attributes: [],
      },
    ],
    attributes: [[fn("DISTINCT", col("perm")), "perm"]],
    raw: true,
  });
  const fromDb = rows.map((r) => r.perm).filter((p) => p && p !== "*");
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
      universe.forEach((u) => _matchesPattern(u, p) && out.add(u));
      out.add(p.slice(0, -2));
    } else {
      out.add(p);
    }
  }
  return out;
}

/** Decide package_name/is_custom summary */
function _decidePackageFields({
  assignedPkgs = [], // [{id, name}]
  defaultPackageId = null,
  hasPermOverrides = false,
  hasFeatureOverrides = false,
}) {
  const multiple = assignedPkgs.length > 1;
  const none = assignedPkgs.length === 0;

  let chosen = null;
  if (defaultPackageId) {
    chosen =
      assignedPkgs.find((p) => Number(p.id) === Number(defaultPackageId)) ||
      null;
  }
  if (!chosen && assignedPkgs.length === 1) chosen = assignedPkgs[0];

  const is_custom = none || multiple || hasPermOverrides || hasFeatureOverrides;
  const pkgNameFromChosen =
    chosen?.name || chosen?.title || chosen?.display_name || null;

  const package_name = is_custom ? "Custom" : pkgNameFromChosen || "Custom";

  return {
    package: { id: chosen?.id ?? null, name: package_name, is_custom },
    package_name,
    is_custom,
  };
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

/** Exclusive switch + clear overrides so user is NOT "Custom" */
exports.setUserPackage = async (
  businessId,
  userId,
  packageId,
  { exclusive = true, clearOverrides = true, setDefault = true } = {}
) => {
  needModel("User", User);
  needModel("BusinessPackage", BusinessPackage);
  needModel("BusinessUserPackage", BusinessUserPackage);
  needModel("UserFeature", UserFeature);
  needModel("UserPermission", UserPermission);

  return sequelize.transaction(async (t) => {
    const [user, pkg] = await Promise.all([
      User.findOne({
        where: { id: userId, business_id: businessId },
        transaction: t,
      }),
      BusinessPackage.findOne({
        where: { id: packageId, business_id: businessId, is_active: true },
        transaction: t,
      }),
    ]);
    if (!user) throw new Error("User not found in this business");
    if (!pkg) throw new Error("Package not found in this business");

    if (exclusive) {
      await BusinessUserPackage.destroy({
        where: { user_id: userId },
        transaction: t,
      });
    }

    await BusinessUserPackage.findOrCreate({
      where: { user_id: userId, package_id: packageId },
      defaults: { user_id: userId, package_id: packageId },
      transaction: t,
    });

    if (setDefault) {
      await user.update({ default_package_id: packageId }, { transaction: t });
    }

    if (clearOverrides) {
      await UserFeature.destroy({ where: { user_id: userId }, transaction: t });
      await UserPermission.destroy({
        where: { user_id: userId },
        transaction: t,
      });
    }

    return { message: "User switched to package", package_id: packageId };
  });
};

/** List all packages assigned to a user (in this business) */
exports.listUserAssignments = async (businessId, userId) => {
  needModel("BusinessUserPackage", BusinessUserPackage);
  needModel("BusinessPackage", BusinessPackage);
  const rows = await BusinessUserPackage.findAll({
    where: { user_id: Number(userId) },
    include: [
      {
        model: BusinessPackage,
        as: "pkg",
        where: { business_id: Number(businessId) },
        required: true,
        attributes: ["id", "name"],
      },
    ],
    attributes: [],
    raw: true,
  });
  return rows.map((r) => ({ id: r["pkg.id"], name: r["pkg.name"] }));
};

/** List all users assigned to a package (in this business) */
exports.listPackageAssignments = async (businessId, packageId) => {
  needModel("BusinessUserPackage", BusinessUserPackage);
  needModel("User", User);
  const rows = await BusinessUserPackage.findAll({
    where: { package_id: Number(packageId) },
    include: [
      {
        model: User,
        where: { business_id: Number(businessId) },
        required: true,
        attributes: ["id", "full_name", "email_address"],
      },
    ],
    attributes: [],
    raw: true,
  });
  return rows.map((r) => ({
    id: r["User.id"],
    full_name: r["User.full_name"],
    email_address: r["User.email_address"],
  }));
};

/* ----------------------------- effective access ---------------------------- */

exports.getEffectiveAccessForUser = async (businessId, userId) => {
  needModel("User", User);

  const bId = Number(businessId);
  const uId = Number(userId);
  if (!bId || !uId) throw new Error("Missing businessId/userId");

  // Ensure the user is in the business (grab default_package_id too)
  const user = await User.findOne({
    where: { id: uId, business_id: bId },
    attributes: ["id", "business_id", "is_active", "default_package_id"],
  });

  if (!user)
    return {
      featuresList: [],
      featuresMap: {},
      permissions: [],
      roles: [],
      packages: [],
      package: { id: null, name: "Custom", is_custom: true },
      package_name: "Custom",
      is_custom: true,
    };

  // ---- 1) BUSINESS allow-list ----
  let bizAllowed = null;
  if (BusinessFeature && Feature) {
    const bfRows = await BusinessFeature.findAll({
      where: { business_id: bId, enabled: true },
      include: [{ model: Feature, as: "feature", attributes: ["code"] }],
    });
    bizAllowed = new Set(bfRows.map((r) => r?.feature?.code).filter(Boolean));
  } else if (Feature) {
    const rows = await Feature.findAll({ attributes: ["code"], raw: true });
    bizAllowed = new Set(rows.map((r) => r.code).filter(Boolean));
  }

  const isAllowed = (code) => {
    if (!code) return false;
    if (bizAllowed == null) return true;
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
          attributes: ["id", "name"],
        },
      ],
      attributes: ["package_id"],
      raw: true,
    });
    activePkgIds = Array.from(
      new Set(assignments.map((r) => r.package_id).filter(Boolean))
    );
  }

  const assignedPkgs = activePkgIds.length
    ? await BusinessPackage.findAll({
        where: { id: { [Op.in]: activePkgIds }, business_id: bId },
        attributes: ["id", "name"],
        raw: true,
      })
    : [];

  // ---- 3) Build user-owned features ----
  const base = {};

  if (activePkgIds.length && BusinessPackageFeature && Feature) {
    const ruleRows = await BusinessPackageFeature.findAll({
      where: { package_id: { [Op.in]: activePkgIds } },
      include: [
        { model: Feature, as: "feature", attributes: ["code", "name"] },
      ],
      attributes: ["enabled", "meta_json"],
    });

    for (const r of ruleRows) {
      const code = r?.feature?.code;
      const name = r?.feature?.name || code;
      if (!isAllowed(code)) continue;
      base[code] = _mergeFeatureRule(base[code], {
        enabled: !!r.enabled,
        meta_json: r.meta_json,
        source: "package",
        name,
      });
    }
  }

  if (UserFeature && Feature) {
    const ufRows = await UserFeature.findAll({
      where: { user_id: uId },
      include: [
        { model: Feature, as: "feature", attributes: ["code", "name"] },
      ],
      attributes: ["enabled", "meta_json"],
    });

    for (const r of ufRows) {
      const code = r?.feature?.code;
      const fname = r?.feature?.name || code;
      if (!isAllowed(code)) continue;
      const cur = base[code] || {
        enabled: false,
        meta_json: null,
        source: "package",
        name: fname,
      };
      base[code] = {
        enabled: r.enabled != null ? !!r.enabled : !!cur.enabled,
        meta_json: r.meta_json != null ? r.meta_json : cur.meta_json,
        source: "user",
        name: cur.name || fname,
      };
    }
  }

  // ---- 4) Permissions = packages ⊕ user ALLOW − user DENY ----
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

  const universe = await _getAllSystemPermissions(bId);
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

  // ---- 5) Compute package summary (name/is_custom) ----
  const hasPermOverrides = !!upRows.length;
  let hasFeatureOverrides = false;
  if (UserFeature) {
    const count = await UserFeature.count({
      where: {
        user_id: uId,
        [Op.or]: [
          { enabled: { [Op.ne]: null } },
          { meta_json: { [Op.ne]: null } },
        ],
      },
    });
    hasFeatureOverrides = count > 0;
  }

  const {
    package: pkgSummary,
    package_name,
    is_custom,
  } = _decidePackageFields({
    assignedPkgs: assignedPkgs.map((p) => ({ id: p.id, name: p.name })),
    defaultPackageId: user.default_package_id ?? null,
    hasPermOverrides,
    hasFeatureOverrides,
  });

  // ---- 6) Return only what the user actually HAS (enabled + gated) ----
  const featuresList = Object.entries(base)
    .filter(([, v]) => !!v.enabled)
    .map(([code, v]) => ({
      code,
      enabled: true,
      name: v.name,
      meta_json: v.meta_json ?? null,
      source: v.source === "user" ? "user" : "package",
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const featuresMap = Object.fromEntries(
    featuresList.map((f) => [
      f.code,
      { enabled: true, name: f.name, meta_json: f.meta_json, source: f.source },
    ])
  );

  const permissions = Array.from(expandedAllow).sort();

  return {
    featuresList,
    featuresMap,
    permissions,
    roles: [],
    packages: assignedPkgs.map((p) => ({ id: p.id, name: p.name })),
    package: pkgSummary,
    package_name,
    is_custom,
  };
};

// Backward-compat alias used by other code
exports.effectiveAccessForUser = exports.getEffectiveAccessForUser;

/* --------- method name aliases expected by your controller/routes ---------- */
exports.listPackages = exports.getAllPackages;
exports.getPackage = exports.getPackageById;
exports.assignUserPackage = (bId, uId, pId) =>
  exports.assignPackageToUser(bId, uId, pId);
exports.unassignUserPackage = (bId, uId, pId) =>
  exports.removePackageFromUser(bId, uId, pId);
