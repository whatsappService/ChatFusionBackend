"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });

const BusinessPackageController = require("../controllers/BusinessPackageController");

// Replace these with your real middlewares
const authenticateUser = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");
const requireFeature = require("../middleware/requireFeature");

// Package management permissions
const requirePackageRead = requirePermission(["packages.read", "packages.manage", "*"]);
const requirePackageWrite = requirePermission(["packages.create", "packages.update", "packages.manage", "*"]);
const requirePackageManage = requirePermission(["packages.manage", "*"]);

/**
 * This router is intended to be mounted at:
 *   app.use("/businesses/:businessId/packages", router)
 *
 * So all paths below are relative to /businesses/:businessId/packages
 */

// List & create
router.get(
  "/",
  authenticateUser,
  requireFeature("packages"),
  requirePackageRead,
  BusinessPackageController.list
);
router.post(
  "/",
  authenticateUser,
  requireFeature("packages"),
  requirePackageWrite,
  BusinessPackageController.create
);

// Single package CRUD
router.get(
  "/:packageId",
  authenticateUser,
  requireFeature("packages"),
  requirePackageRead,
  BusinessPackageController.get
);
router.put(
  "/:packageId",
  authenticateUser,
  requireFeature("packages"),
  requirePackageWrite,
  BusinessPackageController.update
);
router.delete(
  "/:packageId",
  authenticateUser,
  requireFeature("packages"),
  requirePackageManage,
  BusinessPackageController.remove
);

// Package <-> Users assignments
router.get(
  "/:packageId/users",
  authenticateUser,
  requireFeature("packages"),
  requirePackageRead,
  BusinessPackageController.listPackageAssignments
);
router.post(
  "/:packageId/users/:userId",
  authenticateUser,
  requireFeature("packages"),
  requirePackageManage,
  BusinessPackageController.assignUser
);
router.delete(
  "/:packageId/users/:userId",
  authenticateUser,
  requireFeature("packages"),
  requirePackageManage,
  BusinessPackageController.unassignUser
);


module.exports = router;
