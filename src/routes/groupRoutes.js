"use strict";

const express = require("express");
const multer = require("multer");
const router = express.Router();

const groupController = require("../controllers/groupController");
const authMiddleware = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");

// Multer config for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype.startsWith("audio/") ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

// Middleware chain for group management
const mustManageGroups = [
  authMiddleware,
  requireFeature("group_messages"),
  requirePermission("messages.send.group"),
];

// Require media feature if attachments present
const requireMediaIfFiles = (req, res, next) => {
  const anyFiles = Array.isArray(req.files)
    ? req.files.length > 0
    : req.files &&
      Object.values(req.files).some((arr) => Array.isArray(arr) && arr.length);
  if (!anyFiles) return next();
  return requireFeature("media_attachments")(req, res, next);
};

/**
 * GET /api/group/get-groups
 * Get WhatsApp groups from ChatFusion API
 */
router.get(
  "/get-groups",
  authMiddleware,
  requireFeature("group_messages"),
  requirePermission("messages.send.group"),
  groupController.getGroups
);

/**
 * POST /api/group/send-message
 * Send message to a WhatsApp group
 */
router.post(
  "/send-message",
  ...mustManageGroups,
  upload.any(),
  requireMediaIfFiles,
  groupController.sendGroupMessage
);

module.exports = router;
