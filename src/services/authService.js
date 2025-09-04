// src/services/authService.js
"use strict";

const bcrypt = require("bcryptjs");
const { User, Business, BusinessCategory } = require("../models/associations");
const jwtUtil = require("../utils/tokenUtil");
const BusinessPackageService = require("./BusinessPackageService");

/* -------------------- helpers -------------------- */

function sanitizeUser(u) {
  if (!u) return null;
  const json = typeof u.toJSON === "function" ? u.toJSON() : u;
  delete json.password;
  delete json.password_hash;
  return json;
}

async function loadUserByEmail(email_address) {
  if (!email_address) throw new Error("Email is required");
  return User.findOne({
    where: { email_address: String(email_address).trim().toLowerCase() },
  });
}

async function verifyPassword(user, password) {
  const hash = user.password_hash || user.password;
  return hash ? bcrypt.compare(String(password || ""), String(hash)) : false;
}

// Figure out which column on Business is the display name
function getBusinessNameField() {
  const attrs = Business?.rawAttributes || {};
  if (attrs.business_name) return "business_name";
  if (attrs.name) return "name";
  if (attrs.title) return "title";
  // default
  return "business_name";
}

async function loadBusinessLite(businessId) {
  if (!businessId) throw new Error("Missing business_id");
  const nameField = getBusinessNameField();

  const biz = await Business.findByPk(businessId, {
    attributes: [
      "id",
      nameField,
      "business_phone_number",
      "email",
      "category_id",
    ],
    include: [
      {
        model: BusinessCategory,
        as: "category",
        attributes: ["id", "category_name"],
        required: false,
      },
    ],
  });
  if (!biz) throw new Error("Business not found");

  const b = typeof biz.toJSON === "function" ? biz.toJSON() : biz;
  // normalize field name so consumers can always read business.business_name
  if (nameField !== "business_name") {
    b.business_name = b[nameField];
  }
  return b;
}

async function enrichAccess(businessId, userId) {
  const eff = await BusinessPackageService.getEffectiveAccessForUser(
    Number(businessId),
    Number(userId)
  );
  return {
    featuresList: Array.isArray(eff?.featuresList) ? eff.featuresList : [],
    permissions: Array.isArray(eff?.permissions) ? eff.permissions : [],
  };
}

function attachBusinessToUser(user, business) {
  const safe = sanitizeUser(user);
  const business_name =
    business?.business_name ?? business?.name ?? business?.title ?? null;

  return {
    ...safe,
    business_id: user.business_id,
    business_name,
    business, // full object for convenience
  };
}

/* -------------------- API -------------------- */

async function login(email_address, password) {
  const user = await loadUserByEmail(email_address);
  if (!user) throw new Error("Invalid email or password");

  const ok = await verifyPassword(user, password);
  if (!ok) throw new Error("Invalid email or password");

  if (user.business_id == null) {
    const e = new Error("User is not linked to any business");
    e.status = 409;
    throw e;
  }

  const business = await loadBusinessLite(user.business_id);
  const tokens = jwtUtil.generateTokens({
    id: user.id,
    email_address: user.email_address,
    business_id: user.business_id,
    roles: user.roles || [],
  });

  const access = await enrichAccess(user.business_id, user.id);

  const userOut = attachBusinessToUser(user, business);

  return {
    ...tokens,
    user: userOut,
    business, // top-level for easy access
    featuresList: access.featuresList,
    permissions: access.permissions,
  };
}

async function refreshToken(refreshToken) {
  if (!refreshToken) {
    const e = new Error("Refresh token required");
    e.status = 400;
    throw e;
  }

  const decoded = jwtUtil.verifyRefreshToken(refreshToken);
  const userId = decoded?.sub || decoded?.id;
  if (!userId) {
    const e = new Error("Invalid refresh token");
    e.status = 401;
    throw e;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    const e = new Error("User not found");
    e.status = 404;
    throw e;
  }
  if (user.business_id == null) {
    const e = new Error("User is not linked to any business");
    e.status = 409;
    throw e;
  }

  const business = await loadBusinessLite(user.business_id);
  const tokens = jwtUtil.generateTokens({
    id: user.id,
    email_address: user.email_address,
    business_id: user.business_id,
    roles: user.roles || [],
  });
  const access = await enrichAccess(user.business_id, user.id);

  const userOut = attachBusinessToUser(user, business);

  return {
    ...tokens,
    user: userOut,
    business,
    featuresList: access.featuresList,
    permissions: access.permissions,
  };
}

async function getAuthUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    const e = new Error("User not found");
    e.status = 404;
    throw e;
  }
  if (user.business_id == null) {
    const e = new Error("User is not linked to any business");
    e.status = 409;
    throw e;
  }

  const business = await loadBusinessLite(user.business_id);
  const access = await enrichAccess(user.business_id, user.id);

  const userOut = attachBusinessToUser(user, business);

  return {
    user: userOut,
    business,
    featuresList: access.featuresList,
    permissions: access.permissions,
  };
}

module.exports = { login, refreshToken, getAuthUser };
