"use strict";

const express = require("express");
const router = express.Router();

const whatsappController = require("../controllers/whatsappController");
const authMiddleware = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");

const mustManageWhatsapp = [
  authMiddleware,
  requireFeature("api_access"), // the tenant must have API access enabled
  requirePermission("whatsapp.manage"),
];

router.get(
  "/account-info",
  ...mustManageWhatsapp,
  whatsappController.getWhatsappAccountInfo
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
  ...mustManageWhatsapp,
  whatsappController.getWhatsAppStatus
);
router.get(
  "/connect",
  ...mustManageWhatsapp,
  whatsappController.connectToWhatsApp
);
router.post(
  "/check-whatsapp-number",
  ...mustManageWhatsapp,
  whatsappController.checkWhatsAppNumber
);
router.post(
  "/disconnect",
  ...mustManageWhatsapp,
  whatsappController.disconnectWhatsApp
);

module.exports = router;
