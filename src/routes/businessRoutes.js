"use strict";

const express = require("express");
const router = express.Router();

const businessController = require("../controllers/businessController");

// Middleware
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const requireFeature = require("../middleware/requireFeature");

// Controllers
const BusinessUserController = require("../controllers/BusinessUserController");
const AccessCatalogController = require("../controllers/AccessCatalogController");
const BusinessPackageController = require("../controllers/BusinessPackageController");

/* -------------------------------------------------------------------------- */
/* Helper: allow super-admin OR same-business users                           */
/* -------------------------------------------------------------------------- */
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

/* ========================================================================== */
/*                               Business CRUD                                */
/* ========================================================================== */
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

/* ========================================================================== */
/*                          Users of a business (CRUD)                         */
/* ========================================================================== */
router.get(
  "/:businessId/users",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.list
);

router.get(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.getOne
);

router.put(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.update
);

router.patch(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.patch
);

/* Effective access for a USER */
router.get(
  "/:businessId/users/:userId/effective-access",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.effectiveAccess
);

/* Replace user overrides (features + ALLOW permissions) */
router.put(
  "/:businessId/users/:userId/access",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessUserController.updateAccess
);

/* ========================================================================== */
/*                         Access catalog (fixed path)                         */
/* ========================================================================== */
router.get(
  "/:businessId/access-catalog",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  AccessCatalogController.get
);

/* ========================================================================== */
/*                                   Packages                                 */
/* ========================================================================== */

/* READ */
router.get(
  "/:businessId/packages",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessPackageController.list
);

router.get(
  "/:businessId/packages/:packageId",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessPackageController.get
);

/* NEW: package-scoped effective access for preview in UI */
router.get(
  "/:businessId/packages/:packageId/effective-access",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessPackageController.packageEffectiveAccess
);

/* WRITE */
router.post(
  "/:businessId/packages",
  authMiddleware,
  roleMiddleware(["super-admin", "business-admin"]),
  BusinessPackageController.create
);

router.put(
  "/:businessId/packages/:packageId",
  authMiddleware,
  roleMiddleware(["super-admin", "business-admin"]),
  BusinessPackageController.update
);

router.delete(
  "/:businessId/packages/:packageId",
  authMiddleware,
  roleMiddleware(["super-admin", "business-admin"]),
  BusinessPackageController.remove
);

/* Assignments (WRITE) */
router.post(
  "/:businessId/packages/:packageId/users/:userId",
  authMiddleware,
  roleMiddleware(["super-admin", "business-admin"]),
  BusinessPackageController.assignUser
);

router.delete(
  "/:businessId/packages/:packageId/users/:userId",
  authMiddleware,
  roleMiddleware(["super-admin", "business-admin"]),
  BusinessPackageController.unassignUser
);

/* Optional extra reads */
router.get(
  "/:businessId/users/:userId/packages",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessPackageController.listUserAssignments
);

router.get(
  "/:businessId/packages/:packageId/users",
  authMiddleware,
  requireFeature("users"),
  ensureSameBusinessOrSuperAdmin,
  BusinessPackageController.listPackageAssignments
);

module.exports = router;
