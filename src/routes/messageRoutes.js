"use strict";

const express = require("express");
const multer = require("multer");

const messageController = require("../controllers/messageController");
const authenticateUser = require("../middleware/authMiddleware");
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

// Single send
router.post(
  "/send-single",
  authenticateUser,
  requireFeature("single_messages"),
  requirePermission("messages.send"),
  upload.any(),
  requireMediaIfFiles,
  messageController.sendSingleMessage
);

// Alias for frontend compatibility (camelCase)
router.post(
  "/sendSingleMessage",
  authenticateUser,
  requireFeature("single_messages"),
  requirePermission("messages.send"),
  upload.any(),
  requireMediaIfFiles,
  messageController.sendSingleMessage
);

// Bulk send
router.post(
  "/sendBulk",
  authenticateUser,
  requireFeature("bulk_send"),
  requirePermission("messages.bulk"),
  upload.fields([
    { name: "globalFiles", maxCount: 10 },
    { name: "personalFiles", maxCount: 50 },
  ]),
  requireMediaIfFiles,
  messageController.sendBulkMessage
);

module.exports = router;
