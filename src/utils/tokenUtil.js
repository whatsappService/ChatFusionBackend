// src/utils/tokenUtil.js
"use strict";

const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// ---- Config ----
const ISSUER = process.env.JWT_ISSUER || "chatfusion";
const ACCESS_ALG = "HS256";
const REFRESH_ALG = "HS256";

// Small helpers
const makeJti = () => crypto.randomBytes(12).toString("hex");
const makeSid = () => (crypto.randomUUID ? crypto.randomUUID() : makeJti());

// Build minimal, stable payloads
function buildAccessPayload(user, { sessionId, version }) {
  const uid = Number(user.id);
  const bid = Number(user.business_id);
  const roles = Array.isArray(user.roles) ? user.roles : [];

  return {
    // Standard claims
    iss: ISSUER,
    aud: String(bid ?? "public"),
    sub: String(uid),
    jti: makeJti(),
    typ: "access",

    // Minimal private claims
    uid, // user id
    bid, // business/tenant id
    roles, // role slugs, e.g. ["super-admin"]
    sid: sessionId, // session id to tie access/refresh
    ver: version ?? 1, // token version for blanket invalidation
  };
}

function buildRefreshPayload(user, { sessionId, version }) {
  const uid = Number(user.id);
  const bid = Number(user.business_id);

  return {
    iss: ISSUER,
    aud: String(bid ?? "public"),
    sub: String(uid),
    jti: makeJti(),
    typ: "refresh",

    uid,
    sid: sessionId,
    ver: version ?? 1,
  };
}

// Generate short-lived access + long-lived refresh
function generateTokens(user, opts = {}) {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("Missing JWT secrets");
  }

  const sessionId = opts.sessionId || makeSid();
  const version = opts.tokenVersion ?? 1;

  const accessPayload = buildAccessPayload(user, { sessionId, version });
  const refreshPayload = buildRefreshPayload(user, { sessionId, version });

  const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
    algorithm: ACCESS_ALG,
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    mutatePayload: false,
  });

  const refreshToken = jwt.sign(
    refreshPayload,
    process.env.JWT_REFRESH_SECRET,
    {
      algorithm: REFRESH_ALG,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      mutatePayload: false,
    }
  );

  return { accessToken, refreshToken, sessionId };
}

// Verify helpers (explicit alg + small clock tolerance)
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: [ACCESS_ALG],
    clockTolerance: 5,
  });
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    algorithms: [REFRESH_ALG],
    clockTolerance: 5,
  });
  if (decoded?.typ !== "refresh") {
    const err = new Error("Invalid token type");
    err.code = "E_TOKEN_TYPE";
    throw err;
  }
  return decoded;
}

// Back-compat alias if other code imports verifyToken
const verifyToken = verifyAccessToken;

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  verifyToken, // alias
  // (optional) export builders for tests
  _buildAccessPayload: buildAccessPayload,
  _buildRefreshPayload: buildRefreshPayload,
};
