"use strict";
const jwt = require("jsonwebtoken");

const ISSUER = process.env.JWT_ISSUER || "muraasla";
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/** Build stable claims placed into both access & refresh tokens */
function buildJwtClaims(user) {
  const u = typeof user?.toJSON === "function" ? user.toJSON() : user;
  return {
    sub: u.id,
    id: u.id, // backward-compat
    bid: u.business?.id ?? u.business_id ?? null,
    roles: Array.isArray(u.roles) ? u.roles : [],
    ver: 1,
  };
}

function signAccessToken(user) {
  const claims = buildJwtClaims(user);
  return jwt.sign(claims, process.env.JWT_SECRET, {
    issuer: ISSUER,
    algorithm: "HS256",
    expiresIn: ACCESS_EXPIRES,
  });
}

function signRefreshToken(user) {
  const claims = buildJwtClaims(user);
  return jwt.sign(claims, process.env.JWT_REFRESH_SECRET, {
    issuer: ISSUER,
    algorithm: "HS256",
    expiresIn: REFRESH_EXPIRES,
  });
}

const generateTokens = (user, _extrasIgnored = {}) => {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("Missing JWT secret keys in environment variables");
  }
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) throw new Error("Missing JWT secret key");
  // If you want to enforce issuer too, add { issuer: ISSUER } below.
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
};

const verifyRefreshToken = (refreshToken) => {
  if (!process.env.JWT_REFRESH_SECRET)
    throw new Error("Missing JWT refresh secret key");
  return jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, {
    algorithms: ["HS256"],
  });
};

// ---- Backward-compat alias (fixes your error) ----
const verifyAccessToken = verifyToken;

module.exports = {
  generateTokens,
  verifyToken,
  verifyAccessToken, // ← alias used by authMiddleware
  verifyRefreshToken,
};
