"use strict";

const express = require("express");
const multer = require("multer");

const authenticateUser = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");
const chatbotController = require("../controllers/chatbotController");

const router = express.Router();

// JSON / ZIP import support
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "application/json" ||
      file.mimetype === "application/zip" ||
      file.originalname.endsWith(".json") ||
      file.originalname.endsWith(".zip");
    cb(ok ? null : new Error("Only .json or .zip is allowed"), ok);
  },
});

const chain = [
      authenticateUser,
      requireFeature("chatbot"),
      requirePermission("chatbot.manage"),
    ];

// Config
router.get("/config", ...chain, chatbotController.getConfig);
router.patch("/config", ...chain, chatbotController.updateConfig);
router.post("/toggle", ...chain, chatbotController.toggleActive);

// Intents
router.get("/intents", ...chain, chatbotController.listIntents);
router.post("/intents", ...chain, chatbotController.createIntent);
router.patch("/intents/:id", ...chain, chatbotController.updateIntent);
router.delete("/intents/:id", ...chain, chatbotController.deleteIntent);

// Test message
router.post("/test", ...chain, chatbotController.testMessage);

// Import / Export
router.post(
  "/import",
  ...chain,
  upload.single("file"),
  chatbotController.importBot
);
router.get("/export", ...chain, chatbotController.exportBot);

module.exports = router;
