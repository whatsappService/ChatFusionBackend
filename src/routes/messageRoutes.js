const express = require("express");
const multer = require("multer");
const messageController = require("../controllers/messageController");
const authenticateUser = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer(); // Handle file uploads

// ✅ Secure route with authentication
router.post(
  "/send-single",
  authenticateUser,
  upload.array("files"),
  messageController.sendSingleMessage
);

module.exports = router;
