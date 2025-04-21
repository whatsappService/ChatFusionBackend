const messageService = require("../services/messageService");

/** POST /api/messages/single */
exports.sendSingleMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId) {
      console.log("❌ [Controller] Unauthorized single call");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    console.log("📥 [Controller] sendSingleMessage body:", req.body);
    let { recipient, contents } = req.body;

    if (!recipient) {
      console.log("❌ [Controller] Missing recipient");
      return res
        .status(400)
        .json({ success: false, message: "Recipient required" });
    }
    if (!contents) {
      console.log("❌ [Controller] Missing contents");
      return res
        .status(400)
        .json({ success: false, message: "Message required" });
    }

    contents = Array.isArray(contents) ? contents : [contents];
    const files = req.files || [];
    console.log("📎 [Controller] files count:", files.length);

    const result = await messageService.sendSingleMessage(
      bizId,
      recipient,
      contents,
      files
    );
    console.log("✅ [Controller] sendSingleMessage result:", result);

    if (!result.success) {
      return res
        .status(400)
        .json({
          success: false,
          message: result.message,
          failed: result.failed,
        });
    }
    return res.json({ success: true, message: result.message });
  } catch (err) {
    console.error("❌ [Controller] sendSingleMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

/** POST /api/messages/bulk */
exports.sendBulkMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId) {
      console.log("❌ [Controller] Unauthorized bulk call");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    console.log("📥 [Controller] Raw req.body:", req.body);
    let { globalMessages, recipientsData } = req.body;

    if (typeof globalMessages === "string") {
      try {
        globalMessages = JSON.parse(globalMessages);
      } catch {
        console.error("❌ Invalid JSON in globalMessages:", globalMessages);
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON in globalMessages" });
      }
    }
    if (typeof recipientsData === "string") {
      try {
        recipientsData = JSON.parse(recipientsData);
      } catch {
        console.error("❌ Invalid JSON in recipientsData:", recipientsData);
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON in recipientsData" });
      }
    }

    console.log("🔄 [Controller] Parsed globalMessages:", globalMessages);
    console.log("🔄 [Controller] Parsed recipientsData:", recipientsData);

    const globalFiles = req.files?.globalFiles || [];
    console.log("📎 [Controller] globalFiles count:", globalFiles.length);
    console.log("Call to sendBulkMessage");
    
    const result = await messageService.sendBulkMessage(
      bizId,
      globalMessages,
      recipientsData,
      globalFiles
    );
    console.log("✅ [Controller] sendBulkMessage result:", result);

    if (!result.success) {
      return res
        .status(400)
        .json({
          success: false,
          message: result.message,
          failed: result.failedMessages,
        });
    }
    return res.json({ success: true, message: result.message });
  } catch (err) {
    console.error("❌ [Controller] sendBulkMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};
