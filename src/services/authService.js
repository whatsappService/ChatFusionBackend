const bcrypt = require("bcryptjs");
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database"); // 🔸 Use the same instance as your models
const { User, Business, BusinessCategory } = require("../models/associations");
const { generateTokens, verifyRefreshToken } = require("../utils/tokenUtil");

/** Build the “me” payload: user + features (effective, business, user) + tokens */
async function buildAuthPayload(userId) {
  // 1) Full user with business & category
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

  // 2) Features: effective (user → business → default=false), plus raw lists
  const replacements = { userId: user.id, businessId: user.business_id };

  const effective = await sequelize.query(
    `
    SELECT
      f.code,
      COALESCE(uf.enabled, bf.enabled, 0)      AS enabled,
      COALESCE(uf.limit_value, bf.limit_value) AS limit_value,
      COALESCE(uf.meta_json, bf.meta_json)     AS meta_json,
      CASE
        WHEN uf.enabled IS NOT NULL OR uf.limit_value IS NOT NULL OR uf.meta_json IS NOT NULL THEN 'user'
        WHEN bf.enabled IS NOT NULL OR bf.limit_value IS NOT NULL OR bf.meta_json IS NOT NULL THEN 'business'
        ELSE 'default'
      END AS source
    FROM Features f
    LEFT JOIN BusinessFeatures bf ON bf.feature_id = f.id AND bf.business_id = :businessId
    LEFT JOIN UserFeatures uf     ON uf.feature_id = f.id AND uf.user_id    = :userId
    ORDER BY f.code
    `,
    { type: QueryTypes.SELECT, replacements }
  );

  const userOverrides = await sequelize.query(
    `
    SELECT f.code, uf.enabled, uf.limit_value, uf.meta_json
    FROM UserFeatures uf
    JOIN Features f ON f.id = uf.feature_id
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

  const featuresList = effective.map(r => ({
    code: r.code,
    enabled: !!r.enabled,
    limit_value: r.limit_value ?? null,
    meta_json: r.meta_json ?? null,
    source: r.source,
  }));

  const features = Object.fromEntries(
    featuresList.map(f => [f.code, { enabled: f.enabled, limit_value: f.limit_value, meta_json: f.meta_json, source: f.source }])
  );

  // 3) Fresh tokens
  const { accessToken, refreshToken } = generateTokens(user);

  // 4) Final payload
  return {
    accessToken,
    refreshToken,
    user,                 // full user with business + category
    features,             // keyed by code
    featuresList,         // array form
    userFeatureOverrides: userOverrides,   // raw user-level overrides
    businessFeatureToggles: businessToggles // raw business-level toggles
  };
}

exports.login = async (email_address, password) => {
  // Basic auth check
  const user = await User.findOne({ where: { email_address } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error("Invalid credentials");
  }
  // Return the same payload as /me (so frontend has everything after login)
  return buildAuthPayload(user.id);
};

exports.register = async (userData) => {
  userData.password = await bcrypt.hash(userData.password, 10);
  const newUser = await User.create(userData);
  // Return the full payload too (optional). Frontend often redirects to dashboard requiring /me
  return buildAuthPayload(newUser.id);
};

exports.refreshToken = async (refreshToken) => {
  if (!refreshToken) throw new Error("Refresh token required");
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findByPk(decoded.id);
    if (!user) throw new Error("User not found");
    return generateTokens(user);
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
};

exports.getAuthUser = async (userId) => {
  return buildAuthPayload(userId);
};
