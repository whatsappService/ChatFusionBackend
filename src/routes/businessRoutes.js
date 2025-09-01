"use strict";

const express = require("express");
const router = express.Router();

const businessController = require("../controllers/businessController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Users of a business
const BusinessUserController = require("../controllers/BusinessUserController");
const requireFeature = require("../middleware/requireFeature");

function ensureSameBusinessOrSuperAdmin(req, res, next) {
  try {
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    if (roles.includes("super-admin")) return next();

    const paramBusinessId = Number(req.params.businessId || req.params.id);
    if (!paramBusinessId) {
      return res.status(400).json({ error: "InvalidBusinessId" });
    }
    if (Number(req.user?.business_id) === paramBusinessId) return next();

    return res.status(403).json({ error: "AccessDenied" });
  } catch (e) {
    next(e);
  }
}

/* ===== Business CRUD (unchanged) ===== */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessController.createBusiness
);
router.get("/", authMiddleware, businessController.getAllBusinesses);
router.get("/:id", authMiddleware, businessController.getBusinessById);
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessController.updateBusiness
);
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessController.deleteBusiness
);

/* ===== Users of a business ===== */
// LIST
router.get(
  "/:businessId/users",
  authMiddleware,
  requireFeature("multi_user"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.list
);

// GET ONE
router.get(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("multi_user"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.getOne
);

// UPDATE (full/replace semantics if you want)
router.put(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("multi_user"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.update
);

// PATCH (partial; also used by setActive)
router.patch(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("multi_user"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.patch
);
// src/api/routes/businessRoutes.js
router.get(
  "/:businessId/users/:userId/effective-access",
  authMiddleware,
  requireFeature("multi_user"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.effectiveAccess
);

module.exports = router;
