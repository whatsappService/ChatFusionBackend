"use strict";

const express = require("express");
const router = express.Router();

const whatsappController = require("../controllers/whatsappController");
const authMiddleware = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");

const mustManageWhatsapp = [
  authMiddleware,
  requireFeature("whatsapp"),
  requirePermission("whatsapp.manage"),
];

const mustAuthWhatsapp = [
  authMiddleware,
  requireFeature("whatsapp"),
  requirePermission("whatsapp.auth"),
];

router.get(
  "/account-info",
  ...mustManageWhatsapp,
  whatsappController.getWhatsappAccountInfo
);
router.get(
  "/api-key/:businessId",
  ...mustManageWhatsapp,
  whatsappController.getApiKeyByBusinessId
);
router.post(
  "/reset-api-key",
  ...mustManageWhatsapp,
  whatsappController.resetBusinessApiKey
);
router.post(
  "/update-api-key",
  ...mustManageWhatsapp,
  whatsappController.updateBusinessApiKey
);
router.get(
  "/status",
  ...mustAuthWhatsapp,
  whatsappController.getWhatsAppStatus
);
router.get(
  "/connect",
  ...mustAuthWhatsapp,
  whatsappController.connectToWhatsApp
);
router.post(
  "/check-whatsapp-number",
  ...mustManageWhatsapp,
  whatsappController.checkWhatsAppNumber
);
router.post(
  "/disconnect",
  ...mustAuthWhatsapp,
  whatsappController.disconnectWhatsApp
);

module.exports = router;
