"use strict";

const express = require("express");
const multer = require("multer");

const authenticateUser = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");
const scheduleController = require("../controllers/scheduleController");
const scheduleService = require("../services/scheduleService");

const router = express.Router();

const storage = multer.memoryStorage();
const limits = { fileSize: 25 * 1024 * 1024, files: 30 };

// whitelist top-level "files" and dynamic per-item "item_files_<index>"
const fileFilter = (_req, file, cb) => {
  if (
    file.fieldname === "files" ||
    file.fieldname === "attachments" ||
    /^item_files_\d+$/.test(file.fieldname)
  ) {
    return cb(null, true);
  }
  return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
};

const upload = multer({ storage, limits, fileFilter });

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

/* Create */
router.post(
  "/",
  ...base,
  requirePermission("schedules.create"),
  upload.any(), // <— allow both 'files' and 'item_files_*'
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

/* Update */
router.patch(
  "/:id",
  ...base,
  requirePermission("schedules.update"),
  upload.any(), // <— same for PATCH
  requireMediaIfFiles,
  scheduleController.updateSchedule
);

/* Lifecycle */
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

/* Preview cron */
router.post(
  "/preview",
  ...base,
  requirePermission("schedules.read"),
  scheduleController.previewNextRuns
);

/* Run now */
router.post(
  "/:id/run-now",
  ...base,
  requirePermission("schedules.update"),
  scheduleController.runNow
);

/* Dispatcher (optional) */
router.post(
  "/dispatch",
  ...base,
  requirePermission("schedules.update"),
  async (_req, res, next) => {
    try {
      res.json(await scheduleService.dispatchDueSchedules(50));
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
