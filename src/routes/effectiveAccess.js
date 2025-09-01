"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });

const BusinessPackageController = require("../controllers/BusinessPackageController");
const authenticateUser = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const requireBusinessAdmin = roleMiddleware(["super-admin", "business-admin"]);

/**
 * Mounted at:
 *   app.use("/businesses/:businessId/effective-access", router)
 */

// Effective access (features + permissions) for a user
router.get(
  "/:userId",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.effectiveAccess
);

// (Optional) show which packages a user currently has in this business
router.get(
  "/:userId/packages",
  authenticateUser,
  requireBusinessAdmin,
  BusinessPackageController.listUserAssignments
);

module.exports = router;
