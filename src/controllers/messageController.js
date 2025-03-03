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

exports.sendBulkMessage = async (req, res) => {
  try {
    console.log("📥 Bulk message request body:", req.body);
    console.log("📎 Uploaded Files (global & personal):", req.files);
    console.log("👤 Authenticated User:", req.user);

    if (!req.user || !req.user.business_id) {
      return res.status(401).json({
        data: {
          success: false,
          message: "Unauthorized: User not found or business ID missing",
        },
      });
    }

    const { globalMessages, recipientsData } = req.body;
    // Parse JSON fields since they are sent as strings.
    let parsedGlobalMessages, parsedRecipientsData;
    try {
      parsedGlobalMessages = JSON.parse(globalMessages);
      parsedRecipientsData = JSON.parse(recipientsData);
    } catch (parseError) {
      return res.status(400).json({
        data: {
          success: false,
          message: "Invalid JSON in globalMessages or recipientsData",
        },
      });
    }

    // Ensure globalMessages is an array.
    if (!Array.isArray(parsedGlobalMessages)) {
      parsedGlobalMessages = [parsedGlobalMessages];
    }

    // Files
    const globalFiles =
      req.files && req.files.globalFiles ? req.files.globalFiles : [];
    const personalFiles =
      req.files && req.files.personalFiles ? req.files.personalFiles : [];

    const response = await messageService.sendBulkMessage(
      req.user.business_id,
      parsedGlobalMessages,
      parsedRecipientsData,
      globalFiles,
      personalFiles
    );

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
    console.error("❌ Error sending bulk message:", error.message);
    return res.status(500).json({
      data: {
        success: false,
        message: "Failed to send bulk message",
        error: error.message,
      },
    });
  }
};
