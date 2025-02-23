const jwt = require("jsonwebtoken");

const generateTokens = (user) => {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("Missing JWT secret keys in environment variables");
  }

  const accessToken = jwt.sign(
    { id: user.id, roles: user.roles, business_id: user.business_id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // Access Token (short-lived)
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // Refresh Token (long-lived)
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
