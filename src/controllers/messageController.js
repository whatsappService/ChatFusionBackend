const messageService = require("../services/messageService");

exports.sendSingleMessage = async (req, res) => {
  try {
    console.log("📥 Incoming request:", req.body);
    console.log("📎 Uploaded Files:", req.files);
    console.log("👤 Authenticated User:", req.user);

    if (!req.user || !req.user.business_id) {
      return res.status(401).json({
        data: {
          success: false,
          message: "Unauthorized: User not found or business ID missing",
        },
      });
    }

    const { recipient } = req.body;
    let { contents } = req.body;
    const files = req.files || [];

    if (!recipient) {
      return res.status(400).json({
        data: { success: false, message: "Recipient is required" },
      });
    }

    if (!contents) {
      return res.status(400).json({
        data: { success: false, message: "Message content is required" },
      });
    }

    // ✅ Ensure contents is an array
    if (!Array.isArray(contents)) {
      contents = [contents];
    }

    const response = await messageService.sendSingleMessage(
      req.user.business_id,
      recipient,
      contents,
      files
    );

    // ✅ Return failed messages if message not sent
    if (!response.success) {
      return res.status(400).json({
        data: {
          success: false,
          message: response.message,
          failedMessages: response.failedMessages || [],
        },
      });
    }

    return res.json({
      data: {
        success: true,
        message: response.message,
      },
    });
  } catch (error) {
    console.error("❌ Error sending message:", error.message);
    return res.status(500).json({
      data: {
        success: false,
        message: "Failed to send message",
        error: error.message,
      },
    });
  }
};
