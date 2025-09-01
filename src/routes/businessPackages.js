"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });

const BusinessPackageController = require("../controllers/BusinessPackageController");

// Replace these with your real middlewares
const authenticateUser = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// OPTIONAL: gate by role (e.g. super-admin or business-admin)
const requireBusinessAdmin = roleMiddleware(["super-admin", "business-admin"]);

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
  requireBusinessAdmin,
  BusinessPackageController.list
);
router.post(
  "/",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.create
);

// Single package CRUD
router.get(
  "/:packageId",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.get
);
router.put(
  "/:packageId",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.update
);
router.delete(
  "/:packageId",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.remove
);

// Package <-> Users assignments
router.get(
  "/:packageId/users",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.listPackageAssignments
);
router.post(
  "/:packageId/users/:userId",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.assignUser
);
router.delete(
  "/:packageId/users/:userId",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.unassignUser
);


module.exports = router;
