"use strict";

const express = require("express");
const router = express.Router();

const historyController = require("../controllers/historyController");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

router.get(
  "/user-messages",
  authMiddleware,
  requirePermission("analytics.view"),
  historyController.getUserMessages
);

router.get(
  "/user-history",
  authMiddleware,
  requirePermission("analytics.view"),
  historyController.getHistoryBetweenDates
);

router.get(
  "/messages-by-history/:historyId",
  authMiddleware,
  requirePermission("reports.export"),
  historyController.getMessagesByHistory
);

module.exports = router;
