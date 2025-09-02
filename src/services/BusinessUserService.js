"use strict";

const { Op, fn, col, where, literal } = require("sequelize");
const {
  User,
  Business,
  BusinessPackage,
  BusinessUserPackage,
  BusinessPackagePermission,
  UserPermission,
  UserFeature,
} = require("../models/associations");

/* -------------------- helpers -------------------- */

const toRolesArray = (roles) => {
  if (Array.isArray(roles)) return roles.filter(Boolean);
  if (roles == null) return [];
  if (typeof roles === "string") {
    try {
      return roles.trim().startsWith("[")
        ? JSON.parse(roles)
        : roles
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
};

/** Which column on Business holds the display name? */
const getBusinessNameField = () => {
  const attrs = Business?.rawAttributes || {};
  if (attrs.name) return "name";
  if (attrs.business_name) return "business_name";
  if (attrs.title) return "title";
  return "business_name";
};

/** Find actual alias that links User -> Business (services expect 'business') */
const getBusinessAliasOnUser = () => {
  const assocs = User?.associations || {};
  for (const [alias, a] of Object.entries(assocs)) {
    if (a?.target === Business || a?.target?.name === Business?.name) {
      return alias; // e.g. 'business'
    }
  }
  return null;
};

const shapeUserBasic = (u, businessNameField) => {
  const plain = u?.toJSON ? u.toJSON() : u || {};
  const bObj =
    plain?.business || plain?.Business || plain?.company || plain?.org || null;

  const business_name =
    (bObj && bObj[businessNameField]) ||
    plain?.business_name ||
    plain?.businessName ||
    null;

  return {
    ...plain,
    roles: toRolesArray(plain.roles),
    business_name,
  };
};

/** Fallback canon (only used if '*' ever appears locally) */
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

/** Expand '*' into concrete permissions (db + canonical), de-duped & sorted */
async function expandWildcardPermissions(perms) {
  const arr = Array.isArray(perms) ? perms : [];
  if (!arr.includes("*")) return arr;

  const rows = await BusinessPackagePermission.findAll({
    attributes: [[fn("DISTINCT", col("perm")), "perm"]],
    raw: true,
  });
  const fromDb = rows.map((r) => r.perm).filter(Boolean);

  const expanded = Array.from(new Set([...fromDb, ...CANONICAL_PERMS]));
  expanded.sort();
  return expanded;
}

/** Enrich user with features/permissions; lazy-require to avoid circulars */
async function shapeUserWithAccess(businessId, userId, u) {
  const businessNameField = getBusinessNameField();
  const shaped = shapeUserBasic(u, businessNameField);

  try {
    const { getEffectiveAccessForUser } = require("./BusinessPackageService");

    const eff = await getEffectiveAccessForUser(
      Number(businessId),
      Number(userId)
    );
    const featuresList = Array.isArray(eff?.featuresList)
      ? eff.featuresList
      : [];
    const roles = Array.isArray(eff?.roles) ? eff.roles : shaped.roles || [];
    const permissions = await expandWildcardPermissions(eff?.permissions || []);

    return {
      ...shaped,
      featuresList,
      permissions,
      roles,
    };
  } catch {
    return {
      ...shaped,
      featuresList: [],
      permissions: [],
      roles: shaped.roles || [],
    };
  }
}

/** Decide package_name/is_custom for ONE user */
function decidePackageFields({
  assignedPkgs = [],
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

/** Batch load: packages + overrides for a set of userIds in a business */
async function computePackageFieldsBulk(businessId, users) {
  const userIds = users.map((u) => Number(u.id)).filter(Boolean);
  if (!userIds.length) return new Map();

  // --- package assignments (restricted to business) ---
  const assignments = await BusinessUserPackage.findAll({
    where: { user_id: { [Op.in]: userIds } },
    include: [
      {
        model: BusinessPackage,
        as: "pkg",
        where: { business_id: Number(businessId) },
        required: true,
        attributes: ["id", "name"],
      },
    ],
    attributes: ["user_id", "package_id"],
    raw: true,
  });

  const pkgMap = new Map(); // userId -> [{id,name}]
  for (const row of assignments) {
    const uid = Number(row.user_id);
    if (!pkgMap.has(uid)) pkgMap.set(uid, []);
    pkgMap.get(uid).push({ id: row.package_id, name: row["pkg.name"] });
  }

  // --- overrides present? ---
  const permRows = await UserPermission.findAll({
    where: { user_id: { [Op.in]: userIds } },
    attributes: ["user_id"],
    raw: true,
  });
  const permOverrideSet = new Set(permRows.map((r) => Number(r.user_id)));

  const featRows = await UserFeature.findAll({
    where: {
      user_id: { [Op.in]: userIds },
      [Op.or]: [
        { enabled: { [Op.ne]: null } },
        { meta_json: { [Op.ne]: null } },
      ],
    },
    attributes: ["user_id"],
    raw: true,
  });
  const featOverrideSet = new Set(featRows.map((r) => Number(r.user_id)));

  // --- compute fields per user ---
  const out = new Map();
  for (const u of users) {
    const uid = Number(u.id);
    const assignedPkgs = pkgMap.get(uid) || [];
    const fields = decidePackageFields({
      assignedPkgs,
      defaultPackageId: u.default_package_id ?? null,
      hasPermOverrides: permOverrideSet.has(uid),
      hasFeatureOverrides: featOverrideSet.has(uid),
    });
    out.set(uid, fields);
  }
  return out;
}

/** Single-user compute (used by getUserForBusiness) */
async function computePackageFieldsSingle(businessId, user) {
  const uid = Number(user.id);
  const rows = await BusinessUserPackage.findAll({
    where: { user_id: uid },
    include: [
      {
        model: BusinessPackage,
        as: "pkg",
        where: { business_id: Number(businessId) },
        required: true,
        attributes: ["id", "name"],
      },
    ],
    attributes: ["package_id"],
    raw: true,
  });
  const assignedPkgs = rows.map((r) => ({
    id: r.package_id,
    name: r["pkg.name"],
  }));

  const hasPermOverrides = !!(await UserPermission.count({
    where: { user_id: uid },
  }));
  const hasFeatureOverrides = !!(await UserFeature.count({
    where: {
      user_id: uid,
      [Op.or]: [
        { enabled: { [Op.ne]: null } },

        { meta_json: { [Op.ne]: null } },
      ],
    },
  }));

  return decidePackageFields({
    assignedPkgs,
    defaultPackageId: user.default_package_id ?? null,
    hasPermOverrides,
    hasFeatureOverrides,
  });
}

const desiredUserAttrs = [
  "id",
  "full_name",
  "email_address",
  "phone_number",
  "roles",
  "is_active",
  "is_deleted",
  "business_id",
  "default_package_id", // <-- include this so we can prefer the default
  "createdAt",
  "updatedAt",
  "settings",
];

const userSafeAttrs = (() => {
  const modelAttrs = User?.rawAttributes ? Object.keys(User.rawAttributes) : [];
  return desiredUserAttrs.filter((a) => modelAttrs.includes(a));
})();

/* -------------------- exports (functions) -------------------- */

exports.getAllUsersForBusiness = async function getAllUsersForBusiness(
  businessId,
  {
    q,
    includeInactive = false,
    limit = 50,
    offset = 0,
    orderBy = "createdAt",
    orderDir = "DESC",
  } = {}
) {
  const whereClause = { business_id: Number(businessId) };

  if (!includeInactive) {
    whereClause.is_deleted = false;
    whereClause.is_active = true;
  }

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    whereClause[Op.or] = [
      { full_name: { [Op.like]: like } },
      { email_address: { [Op.like]: like } },
      { phone_number: { [Op.like]: like } },
    ];
  }

  const ORDER_FIELDS = new Set(["createdAt", "full_name", "email_address"]);
  const safeOrderBy = ORDER_FIELDS.has(orderBy) ? orderBy : "createdAt";
  const safeOrderDir =
    String(orderDir).toUpperCase() === "ASC" ? "ASC" : "DESC";

  const l = Math.max(0, Number(limit) || 50);
  const o = Math.max(0, Number(offset) || 0);

  const alias = getBusinessAliasOnUser();
  const businessNameField = getBusinessNameField();

  try {
    const { rows, count } = await User.findAndCountAll({
      where: whereClause,
      attributes: userSafeAttrs.length ? userSafeAttrs : undefined,
      include: [
        {
          model: Business,
          ...(alias ? { as: alias } : {}),
          attributes: ["id", businessNameField],
          required: false,
        },
      ],
      limit: l,
      offset: o,
      order: [[safeOrderBy, safeOrderDir]],
    });

    const shaped = rows.map((r) => shapeUserBasic(r, businessNameField));

    // --- attach package_name/is_custom/package in bulk ---
    const pkgFieldsMap = await computePackageFieldsBulk(businessId, shaped);
    const items = shaped.map((u) => ({
      ...u,
      ...(pkgFieldsMap.get(Number(u.id)) || {
        package: { id: null, name: "Custom", is_custom: true },
        package_name: "Custom",
        is_custom: true,
      }),
    }));

    return {
      total: count,
      limit: l,
      offset: o,
      orderBy: safeOrderBy,
      orderDir: safeOrderDir,
      items,
    };
  } catch (err) {
    console.error("getAllUsersForBusiness include failed:", {
      message: err?.message,
      sqlMessage: err?.original?.sqlMessage,
    });

    // Fallback without include
    const { rows, count } = await User.findAndCountAll({
      where: whereClause,
      attributes: userSafeAttrs.length ? userSafeAttrs : undefined,
      limit: l,
      offset: o,
      order: [[safeOrderBy, safeOrderDir]],
    });

    // manual hydrate business_name
    const bizIds = Array.from(
      new Set(rows.map((r) => r.business_id).filter(Boolean))
    );

    const bizMap = {};
    if (bizIds.length) {
      const businesses = await Business.findAll({
        where: { id: { [Op.in]: bizIds } },
        attributes: ["id", businessNameField],
      });
      businesses.forEach((b) => (bizMap[b.id] = b[businessNameField]));
    }

    const shaped = rows.map((r) => {
      const s = shapeUserBasic(r, businessNameField);
      return { ...s, business_name: bizMap[s.business_id] || null };
    });

    const pkgFieldsMap = await computePackageFieldsBulk(businessId, shaped);
    const items = shaped.map((u) => ({
      ...u,
      ...(pkgFieldsMap.get(Number(u.id)) || {
        package: { id: null, name: "Custom", is_custom: true },
        package_name: "Custom",
        is_custom: true,
      }),
    }));

    return {
      total: count,
      limit: l,
      offset: o,
      orderBy: safeOrderBy,
      orderDir: safeOrderDir,
      items,
    };
  }
};

exports.getUserForBusiness = async function getUserForBusiness(
  businessId,
  userId
) {
  const alias = getBusinessAliasOnUser();
  const businessNameField = getBusinessNameField();

  try {
    const user = await User.findOne({
      where: { id: Number(userId), business_id: Number(businessId) },
      attributes: userSafeAttrs.length ? userSafeAttrs : undefined,
      include: [
        {
          model: Business,
          ...(alias ? { as: alias } : {}),
          attributes: ["id", businessNameField],
          required: false,
        },
      ],
    });

    if (!user) return null;

    // access (features/permissions) first
    const withAccess = await shapeUserWithAccess(businessId, userId, user);

    // package fields for this user
    const pkgFields = await computePackageFieldsSingle(
      Number(businessId),
      withAccess
    );

    return { ...withAccess, ...pkgFields };
  } catch (err) {
    console.error("getUserForBusiness include failed:", {
      message: err?.message,
      sqlMessage: err?.original?.sqlMessage,
    });

    const user = await User.findOne({
      where: { id: Number(userId), business_id: Number(businessId) },
      attributes: userSafeAttrs.length ? userSafeAttrs : undefined,
    });
    if (!user) return null;

    // manual hydrate business_name
    let business_name = null;
    if (user.business_id) {
      const b = await Business.findByPk(user.business_id, {
        attributes: ["id", businessNameField],
      });
      business_name = b ? b[businessNameField] : null;
    }

    const shaped = {
      ...shapeUserBasic(user, businessNameField),
      business_name,
    };

    const withAccess = await shapeUserWithAccess(businessId, userId, shaped);
    const pkgFields = await computePackageFieldsSingle(
      Number(businessId),
      withAccess
    );

    return { ...withAccess, ...pkgFields };
  }
};

exports.updateUserForBusiness = async function updateUserForBusiness(
  businessId,
  userId,
  patch = {}
) {
  const user = await User.findOne({
    where: { id: Number(userId), business_id: Number(businessId) },
  });
  if (!user) return null;

  const allowed = new Set([
    "full_name",
    "email_address",
    "phone_number",
    "roles",
    "is_active",
    "settings",
    "default_package_id", // allow changing default package selection
  ]);

  const updates = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!allowed.has(k)) continue;
    if (k === "roles") {
      updates.roles = toRolesArray(v);
      continue;
    }
    if (k === "settings") {
      updates.settings = v && typeof v === "object" ? v : {};
      continue;
    }
    updates[k] = v;
  }

  await user.update(updates);

  // Reload with safe include
  const alias = getBusinessAliasOnUser();
  const businessNameField = getBusinessNameField();
  try {
    await user.reload({
      include: [
        {
          model: Business,
          ...(alias ? { as: alias } : {}),
          attributes: ["id", businessNameField],
          required: false,
        },
      ],
    });
  } catch (err) {
    console.error("updateUserForBusiness reload include failed:", {
      message: err?.message,
      sqlMessage: err?.original?.sqlMessage,
    });
  }

  // Enrich & flatten
  let shaped = shapeUserBasic(user, businessNameField);
  if (!shaped.business_name && shaped.business_id) {
    try {
      const b = await Business.findByPk(shaped.business_id, {
        attributes: ["id", businessNameField],
      });
      shaped = { ...shaped, business_name: b ? b[businessNameField] : null };
    } catch {}
  }

  const withAccess = await shapeUserWithAccess(businessId, userId, shaped);
  const pkgFields = await computePackageFieldsSingle(
    Number(businessId),
    withAccess
  );

  return { ...withAccess, ...pkgFields };
};
