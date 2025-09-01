// src/services/authService.js
"use strict";

const bcrypt = require("bcryptjs");
const { User, Business, BusinessCategory } = require("../models/associations");
const BusinessPackageService = require("../services/BusinessPackageService");
const { generateTokens, verifyRefreshToken } = require("../utils/tokenUtil");

function sanitizeUser(u) {
  if (!u) return u;
  const json = typeof u.toJSON === "function" ? u.toJSON() : u;
  delete json.password;
  return json;
}

async function buildAuthPayload(userId) {
  const user = await User.findOne({
    where: { id: userId },
    include: [
      {
        model: Business,
        as: "business",
        include: [{ model: BusinessCategory, as: "category" }],
      },
    ],
  });
  if (!user) throw new Error("User not found");

  // Effective access is already:
  // - user-scoped (packages + user overrides, user overrides win)
  // - gated by business allow-list (if business disables a feature, user loses it)
  const eff = await BusinessPackageService.getEffectiveAccessForUser(
    user.business_id,
    user.id
  );

  const featuresList = Array.isArray(eff?.featuresList) ? eff.featuresList : [];
  const features = Object.fromEntries(
    featuresList.map((f) => [
      f.code,
      {
        enabled: true,
        limit_value: f.limit_value ?? null,
        meta_json: f.meta_json ?? null,
        source: f.source || "package",
      },
    ])
  );
  const permissions = Array.isArray(eff?.permissions) ? eff.permissions : [];

  const safeUser = sanitizeUser(user);
  const { accessToken, refreshToken } = generateTokens(safeUser);

  return {
    accessToken,
    refreshToken,
    user: safeUser,
    features, // map { code: {enabled:true, limit_value, meta_json, source} }
    featuresList, // array of enabled features the user actually has
    permissions, // expanded, de-duped, deny-applied
  };
}

module.exports = {
  login: async (email_address, password) => {
    const user = await User.findOne({ where: { email_address } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Invalid credentials");
    }
    return buildAuthPayload(user.id);
  },

  register: async (userData) => {
    userData.password = await bcrypt.hash(userData.password, 10);
    const newUser = await User.create(userData);
    return buildAuthPayload(newUser.id);
  },

  refreshToken: async (refreshToken) => {
    if (!refreshToken) throw new Error("Refresh token required");
    const decoded = verifyRefreshToken(refreshToken);
    const uid = decoded?.id ?? decoded?.sub;
    if (!uid) throw new Error("Invalid refresh token payload");
    return buildAuthPayload(uid);
  },

  getAuthUser: async (userId) => buildAuthPayload(userId),
};
