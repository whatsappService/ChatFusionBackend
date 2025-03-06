const express = require("express");
const router = express.Router();
const historyController = require("../controllers/historyController");
const authMiddleware = require("../middleware/authMiddleware");

// Get all user messages (history)
router.get("/user-messages", authMiddleware, historyController.getUserMessages);

// Get history between dates
router.get(
  "/user-history",
  authMiddleware,
  historyController.getHistoryBetweenDates
);

// Get messages by history ID
router.get(
  "/messages-by-history/:historyId",
  authMiddleware,
  historyController.getMessagesByHistory
);

module.exports = router;
