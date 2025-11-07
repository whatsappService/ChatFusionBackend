"use strict";

const express = require("express");
const multer = require("multer");

const messageController = require("../controllers/messageController");
const authenticateUser = require("../middleware/authMiddleware");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype.startsWith("audio/") ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

// Require media feature if attachments present
const requireMediaIfFiles = (req, res, next) => {
  const anyFiles = Array.isArray(req.files)
    ? req.files.length > 0
    : req.files &&
      Object.values(req.files).some((arr) => Array.isArray(arr) && arr.length);
  if (!anyFiles) return next();
  return requireFeature("media_attachments")(req, res, next);
};

// ============================================================================
// NEW API ENDPOINTS (Using x-api-key authentication)
// ============================================================================

// POST /api/messages/send - Send single text message
router.post(
  "/send",
  apiKeyAuth,
  requireFeature("single_messages"),
  requirePermission("messages.send.single"),
  messageController.apiSendMessage
);

// POST /api/messages/send-media - Send media message
router.post(
  "/send-media",
  apiKeyAuth,
  requireFeature("single_messages"),
  requireFeature("media_attachments"),
  requirePermission("messages.send.single"),
  upload.single("media"),
  messageController.apiSendMediaMessage
);

// POST /api/messages/bulk - Send bulk messages
router.post(
  "/bulk",
  apiKeyAuth,
  requireFeature("bulk_send"),
  requirePermission("messages.send.bulk"),
  upload.single("media"),
  messageController.apiSendBulkMessages
);

// POST /api/messages/group - Send group message(s)
router.post(
  "/group",
  apiKeyAuth,
  requireFeature("group_messages"),
  requirePermission("messages.send.group"),
  upload.array("attachments", 10),
  messageController.apiSendGroupMessages
);

// GET /api/messages - Get message history
router.get(
  "/",
  apiKeyAuth,
  requirePermission("reports.view"),
  messageController.apiGetMessages
);

// GET /api/messages/status/:status - Get messages by status
router.get(
  "/status/:status",
  apiKeyAuth,
  requirePermission("reports.view"),
  messageController.apiGetMessagesByStatus
);

// GET /api/messages/failed - Get failed messages
router.get(
  "/failed",
  apiKeyAuth,
  requirePermission("reports.view"),
  messageController.apiGetFailedMessages
);

// ============================================================================
// EXISTING ENDPOINTS (Using JWT Bearer token authentication)
// ============================================================================

// Single send
router.post(
  "/send-single",
  authenticateUser,
  requireFeature("single_messages"),
  requirePermission("messages.send.single"),
  upload.any(),
  requireMediaIfFiles,
  messageController.sendSingleMessage
);

// Alias for frontend compatibility (camelCase)
router.post(
  "/sendSingleMessage",
  authenticateUser,
  requireFeature("single_messages"),
  requirePermission("messages.send.single"),
  upload.any(),
  requireMediaIfFiles,
  messageController.sendSingleMessage
);

// Bulk send
router.post(
  "/sendBulk",
  authenticateUser,
  requireFeature("bulk_send"),
  requirePermission("messages.send.bulk"),
  upload.fields([
    { name: "globalFiles", maxCount: 10 },
    { name: "personalFiles", maxCount: 50 },
  ]),
  requireMediaIfFiles,
  messageController.sendBulkMessage
);

// Group send
router.post(
  "/sendGroup",
  authenticateUser,
  requireFeature("group_messages"),
  requirePermission("messages.send.group"),
  upload.any(),
  requireMediaIfFiles,
  messageController.sendGroupMessage
);

module.exports = router;
