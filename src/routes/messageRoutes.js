const express = require("express");
const multer = require("multer");
const messageController = require("../controllers/messageController");
const authenticateUser = require("../middleware/authMiddleware");

const router = express.Router();
//
// Configure Multer to accept larger files for WhatsApp media attachments.  By default
// Multer sets fairly small file size limits which can prevent users from
// uploading videos.  WhatsApp currently allows media files up to roughly
// 16 MB.  To safely accommodate that limit we set the maximum file size to
// 20 MB.  If needed this value can be further increased via the
// MULTER_FILE_SIZE_LIMIT environment variable.
const maxFileSizeBytes = parseInt(process.env.MULTER_FILE_SIZE_LIMIT, 10) ||
  20 * 1024 * 1024; // Default to 20 MB
const upload = multer({ limits: { fileSize: maxFileSizeBytes } });

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
