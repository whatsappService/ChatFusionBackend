// src/controllers/messageController.js
"use strict";

const messageService = require("../services/messageService");

/** POST /api/messages/single */
exports.sendSingleMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let { recipient, contents, period = "month" } = req.body || {};
    if (!recipient)
      return res
        .status(400)
        .json({ success: false, message: "Recipient required" });
    if (!contents)
      return res
        .status(400)
        .json({ success: false, message: "Message required" });

    contents = Array.isArray(contents) ? contents : [contents];
    const files = req.files || [];

    const result = await messageService.sendSingleMessage(
      bizId,
      recipient,
      contents,
      files,
      { userId: req.user.id, period } // ✅ pass user id for per-user caps
    );

    if (!result.success) {
      // use 403 if quota blocked, else 400
      const status = result.quota?.reason ? 403 : 400;
      return res.status(status).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("sendSingleMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

/** POST /api/messages/bulk */
exports.sendBulkMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let { globalMessages, recipientsData, period = "month" } = req.body || {};

    if (typeof globalMessages === "string") {
      try {
        globalMessages = JSON.parse(globalMessages);
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON in globalMessages" });
      }
    }
    if (typeof recipientsData === "string") {
      try {
        recipientsData = JSON.parse(recipientsData);
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid JSON in recipientsData" });
      }
    }
    if (!Array.isArray(recipientsData) || recipientsData.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "recipientsData is required" });
    }

    const globalFiles = req.files?.globalFiles || [];

    const result = await messageService.sendBulkMessage(
      bizId,
      globalMessages,
      recipientsData,
      globalFiles,
      { userId: req.user.id, period } // ✅ pass user id for per-user caps
    );

    if (!result.success) {
      const status = result.quota?.reason ? 403 : 400;
      return res.status(status).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("sendBulkMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};
