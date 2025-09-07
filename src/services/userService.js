// src/services/userService.js
"use strict";

const bcrypt = require("bcryptjs");
const { User } = require("../models/associations");
const { hashPassword } = require("../utils/hashUtil");
const BusinessPackageService = require("./BusinessPackageService");
const { isValidIana } = require("../utils/timezone"); // timezone utils

/**
 * Normalize/shape the user to always include:
 *   - package      : { id, name, is_custom }
 *   - package_name : string ("Custom" if none/multiple/overrides)
 *   - is_custom    : boolean
 *   - business_name: convenience field (maps Business.name/business_name)
 *   - timezone     : IANA timezone (user.timezone → business.timezone → fallback)
 */
function shapeUserForResponse(user) {
  const u =
    typeof user.get === "function" ? user.get({ plain: true }) : { ...user };

  // business_name convenience
  const bName =
    u?.business?.business_name || u?.business?.name || u?.business_name || null;

  // choose a timezone to expose (user → business → default)
  const DEFAULT_TZ = process.env.SERVER_DEFAULT_TZ || "Asia/Hebron";
  const tzFromUser = typeof u?.timezone === "string" ? u.timezone : null;
  const tzFromBiz =
    typeof u?.business?.timezone === "string" ? u.business.timezone : null;
  const timezone =
    (tzFromUser && isValidIana(tzFromUser) && tzFromUser) ||
    (tzFromBiz && isValidIana(tzFromBiz) && tzFromBiz) ||
    DEFAULT_TZ;

  // packages may be aliased differently across projects
  const assigned =
    (Array.isArray(u.assignedPackages) && u.assignedPackages) ||
    (Array.isArray(u.packages) && u.packages) ||
    [];

  const byId = (id) =>
    assigned.find((p) => Number(p?.id) === Number(u?.default_package_id));

  // choose package: default if set & found; otherwise single; otherwise none
  let chosen = null;
  if (u.default_package_id) chosen = byId(u.default_package_id) || null;
  if (!chosen && assigned.length === 1) chosen = assigned[0];

  // detect overrides -> custom
  const hasPermOverrides =
    Array.isArray(u.permissionOverrides) && u.permissionOverrides.length > 0;

  const featureList = Array.isArray(u.features) ? u.features : [];
  const hasFeatureOverrides = featureList.some((f) => {
    const uf = f?.UserFeature;
    return !!(
      uf &&
      (uf.enabled !== null || uf.limit_value !== null || uf.meta_json !== null)
    );
  });

  const multiple = assigned.length > 1;
  const none = assigned.length === 0;
  const is_custom = none || multiple || hasPermOverrides || hasFeatureOverrides;

  const pkgNameFromChosen =
    chosen?.name || chosen?.title || chosen?.display_name || null;

  const package_name = is_custom ? "Custom" : pkgNameFromChosen || "Custom";

  const pkg = {
    id: chosen?.id ?? null,
    name: package_name,
    is_custom,
  };

  return {
    ...u,
    business_name: bName,
    package: pkg,
    package_name,
    is_custom,
    timezone,
  };
}

/** Attach effective access (features + permissions) */
async function attachEffectiveAccess(shapedUser, providedBusinessId) {
  const businessId = Number(providedBusinessId || shapedUser.business_id || 0);
  const userId = Number(shapedUser.id || 0);

  if (!businessId || !userId) {
    return {
      ...shapedUser,
      featuresList: [],
      featuresMap: {},
      permissions: [],
    };
  }

  try {
    const eff = await BusinessPackageService.getEffectiveAccessForUser(
      businessId,
      userId
    );
    const featuresList = Array.isArray(eff?.featuresList)
      ? eff.featuresList
      : [];
    const featuresMap = eff?.featuresMap || {};
    const permissions = Array.isArray(eff?.permissions) ? eff.permissions : [];

    const pkgFields = {
      package: eff?.package || shapedUser.package,
      package_name:
        typeof eff?.package_name === "string"
          ? eff.package_name
          : shapedUser.package_name,
      is_custom:
        typeof eff?.is_custom === "boolean"
          ? eff.is_custom
          : shapedUser.is_custom,
      packages: Array.isArray(eff?.packages)
        ? eff.packages
        : shapedUser.packages,
    };

    return {
      ...shapedUser,
      ...pkgFields,
      featuresList,
      featuresMap,
      permissions,
    };
  } catch {
    return {
      ...shapedUser,
      featuresList: [],
      featuresMap: {},
      permissions: [],
    };
  }
}

/** ---------- LIST ALL (enriched) ---------- */
exports.getAllUsers = async ({ businessId } = {}) => {
  User.initScopes?.(); // idempotent
  const users = await User.scope(
    "withBusiness",
    "withPackages",
    "withPermissionOverrides",
    "withUserFeatures"
  ).findAll({
    ...(businessId ? { where: { business_id: businessId } } : {}),
    order: [["createdAt", "DESC"]],
  });
  return users.map(shapeUserForResponse);
};

/** ---------- GET BY ID (enriched + EFFECTIVE ACCESS) ---------- */
exports.getUserById = async (id, { businessId } = {}) => {
  User.initScopes?.(); // idempotent

  const where = businessId ? { id, business_id: businessId } : { id };
  const user = await User.scope(
    "withBusiness",
    "withPackages",
    "withPermissionOverrides",
    "withUserFeatures"
  ).findOne({ where });

  if (!user) return null;

  const shaped = shapeUserForResponse(user);
  return await attachEffectiveAccess(shaped, businessId);
};

/** ---------- CREATE / UPDATE / DELETE ---------- */
exports.createUser = async (data) => {
  // Accept timezone if valid; otherwise drop it (avoid bad values)
  if (data?.timezone && !isValidIana(data.timezone)) delete data.timezone;

  data.password = await hashPassword(data.password);
  const user = await User.create(data);
  return await exports.getUserById(user.id, { businessId: user.business_id });
};

exports.updateUser = async (id, data, { businessId } = {}) => {
  const where = businessId ? { id, business_id: businessId } : { id };
  const user = await User.findOne({ where });
  if (!user) throw new Error("User not found");

  // Normalize timezone if present
  if (Object.prototype.hasOwnProperty.call(data, "timezone")) {
    if (!data.timezone || !isValidIana(data.timezone)) {
      delete data.timezone; // ignore invalid
    }
  }

  if (data.password) data.password = await hashPassword(data.password);
  await user.update(data);

  return await exports.getUserById(user.id, { businessId: user.business_id });
};

exports.deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error("User not found");
  await user.destroy();
  return { message: "User deleted successfully" };
};

/** ---------- PROFILE / PASSWORD ---------- */
exports.updateProfile = async (userId, userData) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");

  const updatable = ["full_name", "email_address", "phone_number", "timezone"];
  const patch = {};

  for (const k of Object.keys(userData || {})) {
    if (k === "timezone") {
      if (isValidIana(userData.timezone)) patch.timezone = userData.timezone;
      continue;
    }
    if (updatable.includes(k)) patch[k] = userData[k];
  }

  await user.update(patch);
  return await exports.getUserById(user.id, { businessId: user.business_id });
};

exports.changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");

  const stored = user.password || user.password_hash;
  const isMatch = stored
    ? await bcrypt.compare(String(oldPassword || ""), String(stored))
    : false;
  if (!isMatch) throw new Error("Old password is incorrect");

  user.password = await hashPassword(newPassword);
  await user.save();
};

exports.verifyPassword = async (userId, password) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");
  const stored = user.password || user.password_hash;
  return stored
    ? await bcrypt.compare(String(password || ""), String(stored))
    : false;
};

/** Optional: dedicated setter (e.g., /users/me/timezone) */
exports.setUserTimezone = async (userId, timezone) => {
  if (!isValidIana(timezone)) throw new Error("Invalid timezone");
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");
  await user.update({ timezone });
  return await exports.getUserById(user.id, { businessId: user.business_id });
};
