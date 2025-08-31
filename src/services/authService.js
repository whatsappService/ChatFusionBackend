// src/services/authService.js
const bcrypt = require("bcryptjs");
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const { User, Business, BusinessCategory } = require("../models/associations");
const { generateTokens, verifyRefreshToken } = require("../utils/tokenUtil");
const { gatherRolePermissions } = require("../utils/acl"); // <—

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

  const replacements = { userId: user.id, businessId: user.business_id };

  // EFFECTIVE FEATURES: only features the business has
  const effective = await sequelize.query(
    `
  SELECT
    f.code,
    COALESCE(uf.enabled, bf.enabled, 0)      AS enabled,
    COALESCE(uf.limit_value, bf.limit_value) AS limit_value,
    COALESCE(uf.meta_json, bf.meta_json)     AS meta_json,
    CASE
      WHEN uf.enabled IS NOT NULL OR uf.limit_value IS NOT NULL OR uf.meta_json IS NOT NULL THEN 'user'
      ELSE 'business'
    END AS source
  FROM BusinessFeatures bf
  JOIN Features f
    ON f.id = bf.feature_id
  LEFT JOIN UserFeatures uf
    ON uf.feature_id = f.id AND uf.user_id = :userId
  WHERE bf.business_id = :businessId
  ORDER BY f.code
  `,
    { type: QueryTypes.SELECT, replacements }
  );

  // USER OVERRIDES: only for features the business has
  const userOverrides = await sequelize.query(
    `
  SELECT f.code, uf.enabled, uf.limit_value, uf.meta_json
  FROM UserFeatures uf
  JOIN Features f
    ON f.id = uf.feature_id
  JOIN BusinessFeatures bf
    ON bf.feature_id = f.id AND bf.business_id = :businessId
  WHERE uf.user_id = :userId
  ORDER BY f.code
  `,
    { type: QueryTypes.SELECT, replacements }
  );

  const businessToggles = await sequelize.query(
    `
    SELECT f.code, bf.enabled, bf.limit_value, bf.meta_json
    FROM BusinessFeatures bf
    JOIN Features f ON f.id = bf.feature_id
    WHERE bf.business_id = :businessId
    ORDER BY f.code
    `,
    { type: QueryTypes.SELECT, replacements }
  );

  const featuresList = effective.map((r) => ({
    code: r.code,
    enabled: !!r.enabled,
    limit_value: r.limit_value ?? null,
    meta_json: r.meta_json ?? null,
    source: r.source,
  }));
  const features = Object.fromEntries(
    featuresList.map((f) => [
      f.code,
      {
        enabled: f.enabled,
        limit_value: f.limit_value,
        meta_json: f.meta_json,
        source: f.source,
      },
    ])
  );

  // NEW: compute permissions from roles (super-admin => ["*"])
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const permissions = gatherRolePermissions(roles); // returns ["*"] for super-admin

  const { accessToken, refreshToken } = generateTokens(user, {
    features,
    featuresList,
    userFeatureOverrides: userOverrides,
    businessFeatureToggles: businessToggles,
    permissions, // <— include in token
  });

  return {
    accessToken,
    refreshToken,
    user,
    features,
    featuresList,
    userFeatureOverrides: userOverrides,
    businessFeatureToggles: businessToggles,
    permissions, // <— include in response
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
    const uid = decoded?.id ?? decoded?.sub; // 👈 accept sub fallback
    if (!uid) throw new Error("Invalid refresh token payload");
    return buildAuthPayload(uid); // re-pulls fresh data
  },

  getAuthUser: async (userId) => buildAuthPayload(userId),
};
