"use strict";

const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");
const analyticsController = require("../controllers/analyticsController");

const router = express.Router();
const canViewAnalytics = [
  authenticateUser,
  requireFeature("analytics"),
  requirePermission("analytics.view"),
];

router.get("/overview", ...canViewAnalytics, analyticsController.getOverview);
router.get(
  "/messages/daily",
  ...canViewAnalytics,
  analyticsController.getDailyMessages
);
router.get(
  "/deliverability",
  ...canViewAnalytics,
  analyticsController.getDeliverability
);
router.get(
  "/contacts/growth",
  ...canViewAnalytics,
  analyticsController.getContactsGrowth
);
router.get(
  "/templates/usage",
  ...canViewAnalytics,
  analyticsController.getTemplateUsage
);

// Export CSV (stricter permission)
router.get(
  "/export",
  authenticateUser,
  requireFeature("analytics"),
  requirePermission("reports.export"),
  analyticsController.exportCsv
);

module.exports = router;
