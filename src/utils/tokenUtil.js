const jwt = require("jsonwebtoken");

const generateTokens = (user) => {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("Missing JWT secret keys in environment variables");
  }

  const accessToken = jwt.sign(
    {
      id: user.id,
      full_name: user.full_name || null,
      email_address: user.email_address || null,
      phone_number: user.phone_number || null,
      roles: user.roles || [],
      is_active: user.is_active ?? true,
      is_deleted: user.is_deleted ?? false,
      created_at: user.createdAt || null,
      updated_at: user.updatedAt || null,

      // ✅ Include Business Info
      business: user.business
        ? {
            id: user.business.id,
            business_name: user.business.business_name || null,
            business_phone_number: user.business.business_phone_number || null,
            email: user.business.email || null,
            api_key: user.business.api_key || null,
            is_active: user.business.is_active ?? true,
            is_deleted: user.business.is_deleted ?? false,

            // ✅ Include Business Category Info
            category: user.business.category
              ? {
                  id: user.business.category.id,
                  category_name: user.business.category.category_name || null,
                }
              : null,
          }
        : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    {
      id: user.id,
      email_address: user.email_address || null,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) throw new Error("Missing JWT secret key");
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (refreshToken) => {
  if (!process.env.JWT_REFRESH_SECRET)
    throw new Error("Missing JWT refresh secret key");
  return jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  generateTokens,
  verifyToken,
  verifyRefreshToken,
};
