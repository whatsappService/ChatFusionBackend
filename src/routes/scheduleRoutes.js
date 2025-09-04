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

const base = [authenticateUser, requireFeature("scheduled_messages")];

/* Create schedule */
router.post(
  "/",
  ...base,
  requirePermission("schedules.create"),
  upload.array("files", 10),
  requireMediaIfFiles,
  scheduleController.createSchedule
);

/* List / Get */
router.get(
  "/",
  ...base,
  requirePermission("schedules.read"),
  scheduleController.listSchedules
);
router.get(
  "/:id",
  ...base,
  requirePermission("schedules.read"),
  scheduleController.getSchedule
);

/* Update / lifecycle */
router.patch(
  "/:id",
  ...base,
  requirePermission("schedules.update"),
  upload.array("files", 10),
  requireMediaIfFiles,
  scheduleController.updateSchedule
);

router.post(
  "/:id/pause",
  ...base,
  requirePermission("schedules.update"),
  scheduleController.pauseSchedule
);
router.post(
  "/:id/resume",
  ...base,
  requirePermission("schedules.update"),
  scheduleController.resumeSchedule
);
router.post(
  "/:id/cancel",
  ...base,
  requirePermission("schedules.update"),
  scheduleController.cancelSchedule
);

/* Delete */
router.delete(
  "/:id",
  ...base,
  requirePermission("schedules.delete"),
  scheduleController.deleteSchedule
);

/* Preview cron */
router.post(
  "/preview",
  ...base,
  requirePermission("schedules.read"),
  scheduleController.previewNextRuns
);

/* Run now (optional stronger perm; keep update) */
router.post(
  "/:id/run-now",
  ...base,
  requirePermission("schedules.update"),
  scheduleController.runNow
);

module.exports = router;
