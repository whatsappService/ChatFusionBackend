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

module.exports = router;
