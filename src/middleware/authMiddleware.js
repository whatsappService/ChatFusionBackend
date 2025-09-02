"use strict";

const { verifyAccessToken } = require("../utils/tokenUtil");
const { User } = require("../models/associations");
const BusinessPackageService = require("../services/BusinessPackageService");

module.exports = async function authMiddleware(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = verifyAccessToken(token);
    const userId = decoded?.id ?? decoded?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findByPk(userId, {
      attributes: ["id", "business_id", "is_active"],
    });
    if (!user || user.is_active === false) {
      return res.status(403).json({ error: "AccountDisabled" });
    }

    const businessId = decoded?.bid ?? user.business_id;

    const eff = await BusinessPackageService.getEffectiveAccessForUser(
      businessId,
      userId
    );

    const featuresList = Array.isArray(eff?.featuresList)
      ? eff.featuresList
      : [];
    const permissions = Array.isArray(eff?.permissions) ? eff.permissions : [];

    req.user = {
      id: user.id,
      business_id: businessId,
      roles: Array.isArray(decoded?.roles) ? decoded.roles : [],
      permissions,
      featuresList,
    };

    req.access = {
      permSet: new Set(permissions),
      featureSet: new Set(
        featuresList.filter((f) => f?.enabled).map((f) => f.code)
      ),
    };

    // back-compat
    req.ctx = req.ctx || {};
    req.ctx.effectiveAccess = eff || { featuresMap: {}, permissions: [] };
    req.ctx.packagePermissions = new Set(permissions);

    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized", message: err?.message });
  }
};
