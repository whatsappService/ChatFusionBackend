"use strict";

const express = require("express");
const router = express.Router();

const businessController = require("../controllers/businessController");

// Middleware
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requireBusinessScope = require("../middleware/requireBusinessScope"); // ⬅️ NEW

// Controllers
const BusinessUserController = require("../controllers/BusinessUserController");
const AccessCatalogController = require("../controllers/AccessCatalogController");
const BusinessPackageController = require("../controllers/BusinessPackageController");

/* ========================================================================== */
/*                               Business CRUD                                */
/* ========================================================================== */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["admin"]),
  businessController.createBusiness
);

router.get("/", authMiddleware, businessController.getAllBusinesses);

router.get("/:id", authMiddleware, businessController.getBusinessById);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  businessController.updateBusiness
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  businessController.deleteBusiness
);

/* ========================================================================== */
/*                          Users of a business (CRUD)                         */
/* ========================================================================== */
router.get(
  "/:businessId/users",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(), // ⬅️ replaces ensureSameBusinessOrSuperAdmin
  BusinessUserController.list
);

router.get(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessUserController.getOne
);

router.put(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessUserController.update
);

router.patch(
  "/:businessId/users/:userId",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessUserController.patch
);

/* Effective access for a USER */
router.get(
  "/:businessId/users/:userId/effective-access",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessUserController.effectiveAccess
);

/* Replace user overrides (features + ALLOW permissions) */
router.put(
  "/:businessId/users/:userId/access",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessUserController.updateAccess
);

/* ========================================================================== */
/*                         Access catalog (fixed path)                         */
/* ========================================================================== */
router.get(
  "/:businessId/access-catalog",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
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
  requireBusinessScope(),
  BusinessPackageController.list
);

router.get(
  "/:businessId/packages/:packageId",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessPackageController.get
);

/* NEW: package-scoped effective access for preview in UI */
router.get(
  "/:businessId/packages/:packageId/effective-access",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessPackageController.packageEffectiveAccess
);

/* WRITE */
router.post(
  "/:businessId/packages",
  authMiddleware,
  roleMiddleware(["admin", "business-admin"]),
  requireBusinessScope(), // ⬅️ enforces same-business; admin can cross-tenant
  BusinessPackageController.create
);

router.put(
  "/:businessId/packages/:packageId",
  authMiddleware,
  roleMiddleware(["admin", "business-admin"]),
  requireBusinessScope(),
  BusinessPackageController.update
);

router.delete(
  "/:businessId/packages/:packageId",
  authMiddleware,
  roleMiddleware(["admin", "business-admin"]),
  requireBusinessScope(),
  BusinessPackageController.remove
);

/* Assignments (WRITE) */
router.post(
  "/:businessId/packages/:packageId/users/:userId",
  authMiddleware,
  roleMiddleware(["admin", "business-admin"]),
  requireBusinessScope(),
  BusinessPackageController.assignUser
);

router.delete(
  "/:businessId/packages/:packageId/users/:userId",
  authMiddleware,
  roleMiddleware(["admin", "business-admin"]),
  requireBusinessScope(),
  BusinessPackageController.unassignUser
);

/* Optional extra reads */
router.get(
  "/:businessId/users/:userId/packages",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessPackageController.listUserAssignments
);

router.get(
  "/:businessId/packages/:packageId/users",
  authMiddleware,
  requireFeature("users"),
  requireBusinessScope(),
  BusinessPackageController.listPackageAssignments
);

module.exports = router;
