// src/middleware/authMiddleware.js
"use strict";

const { verifyAccessToken } = require("../utils/tokenUtil");
const { User } = require("../models/associations");
const BusinessPackageService = require("../services/BusinessPackageService");

function toRolesArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    try {
      return v.trim().startsWith("[")
        ? JSON.parse(v)
        : v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

module.exports = async function authMiddleware(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = verifyAccessToken(token);
    const userId = decoded?.id ?? decoded?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ⬇️ include roles from DB
    const user = await User.findByPk(userId, {
      attributes: ["id", "business_id", "is_active"],
    });
    if (!user || user.is_active === false) {
      return res.status(403).json({ error: "AccountDisabled" });
    }

    const businessId = decoded?.bid ?? user.business_id;

    // Effective access (features & permissions)
    const eff = await BusinessPackageService.getEffectiveAccessForUser(
      businessId,
      userId
    );

    const featuresList = Array.isArray(eff?.featuresList)
      ? eff.featuresList
      : [];
    const permissions = Array.isArray(eff?.permissions) ? eff.permissions : [];

    // ⬇️ Merge roles: JWT roles + DB roles

    const jwtRoles = toRolesArray(decoded?.roles || []);
    const roleSet = new Set(jwtRoles.map((r) => String(r).toLowerCase()));

    // ⬇️ Compatibility: infer "admin" role if user has wildcard permissions
    // (optional: also infer from specific manage perms if you like)
    const permSet = new Set(permissions);
    if (permSet.has("*")) roleSet.add("admin");

    req.user = {
      id: user.id,
      business_id: businessId,
      roles: Array.from(roleSet), // <-- now populated
      permissions,
      featuresList,
    };

    req.access = {
      permSet,
      featureSet: new Set(
        featuresList.filter((f) => f?.enabled).map((f) => f.code)
      ),
    };

    // back-compat objects some code uses
    req.ctx = req.ctx || {};
    req.ctx.effectiveAccess = eff || { featuresMap: {}, permissions: [] };
    req.ctx.packagePermissions = permSet;

    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized", message: err?.message });
  }
};
