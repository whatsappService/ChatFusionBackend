// src/routes/usageRoutes.js
"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const usageController = require("../controllers/usageController");
const requirePermission = require("../middleware/requirePermission");

// block cross-business access unless you have a separate admin guard
function requireSameBusiness(req, res, next) {
  if (Number(req.params.businessId) !== Number(req.user.business_id)) {
    return res.status(403).json({
      error: "CrossBusinessAccessDenied",
      message: "You cannot access usage for another business.",
    });
  }
  next();
}

// Check if user has admin/superadmin role
function requireAdmin(req, res, next) {
  const roles = req.user?.roles || [];
  const isAdmin = roles.some(r => ["admin", "superadmin", "provider"].includes(r.toLowerCase()));
  const hasPerm = req.access?.permSet?.has("*") || req.access?.permSet?.has("usage.manage");
  
  if (!isAdmin && !hasPerm) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "Admin privileges required"
    });
  }
  next();
}

// ============================================================================
// NEW API ENDPOINTS (Using x-api-key authentication)
// ============================================================================

// GET /api/usage - Get usage statistics
router.get(
  "/",
  apiKeyAuth,
  usageController.apiGetUsage
);

// GET /api/usage/limits/:userId - Get usage limits for a user
router.get(
  "/limits/:userId",
  apiKeyAuth,
  requireAdmin,
  usageController.apiGetUsageLimits
);

// POST /api/usage/limits/:userId - Set usage limits
router.post(
  "/limits/:userId",
  apiKeyAuth,
  requireAdmin,
  usageController.apiSetUsageLimits
);

// PUT /api/usage/limits/:userId - Update usage limits
router.put(
  "/limits/:userId",
  apiKeyAuth,
  requireAdmin,
  usageController.apiUpdateUsageLimits
);

// DELETE /api/usage/limits/:userId - Delete usage limits
router.delete(
  "/limits/:userId",
  apiKeyAuth,
  requireAdmin,
  usageController.apiDeleteUsageLimits
);

// ============================================================================
// EXISTING ENDPOINTS (Using JWT Bearer token authentication)
// ============================================================================

// GET /api/usage/my
router.get("/my", auth, usageController.getMyUsage);

// GET /api/usage/businesses/:businessId
router.get(
  "/businesses/:businessId",
  auth,
  requireSameBusiness,
  usageController.getBusinessUsage
);

module.exports = router;
