const express = require("express");
const multer = require("multer");
const messageController = require("../controllers/messageController");
const authenticateUser = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer(); // Handle file uploads

// Route for sending a single message
router.post(
  "/send-single",
  authenticateUser,
  upload.array("files"),
  messageController.sendSingleMessage
);

// NEW: Route for sending bulk messages
router.post(
  "/sendBulk",
  authenticateUser,
  upload.fields([
    { name: "globalFiles", maxCount: 10 },
    { name: "personalFiles", maxCount: 50 },
  ]),
  messageController.sendBulkMessage
);

module.exports = router;
