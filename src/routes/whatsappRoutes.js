const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsappController");
const authMiddleware = require("../middleware/authMiddleware");

router.get(
  "/account-info",
  authMiddleware,
  whatsappController.getWhatsappAccountInfo
);
router.post(
  "/reset-api-key",
  authMiddleware,
  whatsappController.resetBusinessApiKey
);
router.post(
  "/update-api-key",
  authMiddleware,
  whatsappController.updateBusinessApiKey
);

router.get("/status", authMiddleware, whatsappController.getWhatsAppStatus);
router.get("/connect", authMiddleware, whatsappController.connectToWhatsApp);
module.exports = router;
