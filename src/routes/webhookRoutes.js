"use strict";

const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");
const webhookController = require("../controllers/webhookController");

const router = express.Router();

const mustManageWebhooks = [
  authenticateUser,
  requireFeature("webhooks"),
  requirePermission("webhooks.manage"),
];

router.get("/config", ...mustManageWebhooks, webhookController.getConfig);
router.patch("/config", ...mustManageWebhooks, webhookController.updateConfig);
router.post(
  "/rotate-secret",
  ...mustManageWebhooks,
  webhookController.rotateSecret
);

router.get(
  "/subscriptions",
  ...mustManageWebhooks,
  webhookController.listSubscriptions
);
router.post(
  "/subscriptions",
  ...mustManageWebhooks,
  webhookController.createSubscription
);
router.patch(
  "/subscriptions/:id",
  ...mustManageWebhooks,
  webhookController.updateSubscription
);
router.delete(
  "/subscriptions/:id",
  ...mustManageWebhooks,
  webhookController.deleteSubscription
);

router.get("/logs", ...mustManageWebhooks, webhookController.listLogs);
router.get("/logs/:id", ...mustManageWebhooks, webhookController.getLog);

// Public receiver (signature verified inside controller)
router.post("/incoming", webhookController.receive);

module.exports = router;
