"use strict";

const express = require("express");
const multer = require("multer");

const authenticateUser = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");
const scheduleController = require("../controllers/scheduleController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 30 },
});

const requireMediaIfFiles = (req, res, next) => {
  const files = Array.isArray(req.files)
    ? req.files
    : req.files && Object.values(req.files).flat();
  const anyFiles = Array.isArray(files) && files.length > 0;
  return anyFiles
    ? requireFeature("media_attachments")(req, res, next)
    : next();
};

const chain = [
  authenticateUser,
  requireFeature("scheduled_messages"),
  requirePermission("messages.schedule"),
];

// Create schedule
router.post(
  "/",
  ...chain,
  upload.array("files", 10),
  requireMediaIfFiles,
  scheduleController.createSchedule
);

// List / Get
router.get("/", ...chain, scheduleController.listSchedules);
router.get("/:id", ...chain, scheduleController.getSchedule);

// Update / lifecycle
router.patch(
  "/:id",
  ...chain,
  upload.array("files", 10),
  requireMediaIfFiles,
  scheduleController.updateSchedule
);

router.post("/:id/pause", ...chain, scheduleController.pauseSchedule);
router.post("/:id/resume", ...chain, scheduleController.resumeSchedule);
router.post("/:id/cancel", ...chain, scheduleController.cancelSchedule);
router.delete("/:id", ...chain, scheduleController.deleteSchedule);

// Preview cron
router.post("/preview", ...chain, scheduleController.previewNextRuns);

// Run now
router.post("/:id/run-now", ...chain, scheduleController.runNow);

module.exports = router;
