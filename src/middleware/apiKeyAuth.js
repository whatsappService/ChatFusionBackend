// src/middleware/apiKeyAuth.js
"use strict";

const { Business, User } = require("../models/associations");
const BusinessPackageService = require("../services/BusinessPackageService");

/**
 * Middleware to authenticate requests using x-api-key header
 * This is an alternative to JWT Bearer token authentication
 * Used for external API access (as documented in API documentation)
 */
module.exports = async function apiKeyAuth(req, res, next) {
  try {
    const apiKey = req.headers["x-api-key"];
    
    if (!apiKey) {
      return res.status(401).json({ 
        success: false,
        error: "Missing API key",
        message: "x-api-key header is required"
      });
    }

    // Find business by API key
    const business = await Business.findOne({
      where: { api_key: apiKey },
      attributes: ["id", "business_name", "is_active"],
    });

    if (!business) {
      return res.status(401).json({ 
        success: false,
        error: "Invalid API key"
      });
    }

    if (!business.is_active) {
      return res.status(403).json({ 
        success: false,
        error: "Business account is disabled"
      });
    }

    // For API key authentication, we need to find the business owner/admin user
    // to properly enforce usage limits and permissions
    const user = await User.findOne({
      where: { 
        business_id: business.id,
        is_active: true
      },
      attributes: ["id", "business_id", "is_active"],
      order: [["id", "ASC"]], // Get first user (typically the owner)
    });

    if (!user) {
      return res.status(403).json({ 
        success: false,
        error: "No active user found for this business"
      });
    }

    // Get effective access (features & permissions) for the user
    const eff = await BusinessPackageService.getEffectiveAccessForUser(
      business.id,
      user.id
    );

    const featuresList = Array.isArray(eff?.featuresList)
      ? eff.featuresList
      : [];
    const permissions = Array.isArray(eff?.permissions) ? eff.permissions : [];
    const permSet = new Set(permissions);

    // Set up req.user similar to JWT auth middleware
    req.user = {
      id: user.id,
      business_id: business.id,
      roles: permSet.has("*") ? ["admin"] : [],
      permissions,
      featuresList,
    };

    req.access = {
      permSet,
      featureSet: new Set(
        featuresList.filter((f) => f?.enabled).map((f) => f.code)
      ),
    };

    // Back-compat objects
    req.ctx = req.ctx || {};
    req.ctx.effectiveAccess = eff || { featuresMap: {}, permissions: [] };
    req.ctx.packagePermissions = permSet;

    next();
  } catch (err) {
    console.error("API Key Auth Error:", err);
    res.status(401).json({ 
      success: false,
      error: "Unauthorized", 
      message: err?.message 
    });
  }
};


