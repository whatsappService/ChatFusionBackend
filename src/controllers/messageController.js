// controllers/messageController.js
"use strict";

const messageService = require("../services/messageService");
const MessageQuota = require("../services/MessageQuotaService"); // (unchanged import)
const { normalizePeriod } = require("../utils/periodUtil"); // (unchanged import)
const { User, Message } = require("../models/associations");
const { Op } = require("sequelize");

/** Feature code to meter */
const FEATURE_SEND = "bulk_send";

/** Default period key (align with your plan cycle) */
const DEFAULT_PERIOD = "month";

/** Count units for a single send (1 send == 1 unit) */
function unitsForSingle(_recipient, _contents) {
  return 1;
}

/** Count units for bulk (1 unit per recipient we attempt to send to) */
function unitsForBulk(recipientsData) {
  if (!Array.isArray(recipientsData)) return 0;
  const set = new Set(
    recipientsData
      .map((r) => r?.phone || r?.recipient || r?.whatsapp_number || r?.to)
      .filter(Boolean)
  );
  return set.size || recipientsData.length;
}

/** Pre-check if the user/business can spend `units`. */
async function canSpend(businessId, userId, units, featureCode, periodName) {
  const period = normalizePeriod(periodName || DEFAULT_PERIOD);

  const [bizCap, userCap, usageUser, usageBiz] = await Promise.all([
    MessageQuota.getBusinessCap(businessId, featureCode),
    MessageQuota.getUserCap(businessId, userId, featureCode),
    MessageQuota.getUsage({ businessId, userId, featureCode, period }),
    MessageQuota.getUsage({ businessId, userId: null, featureCode, period }),
  ]);

  const remainingUser =
    userCap == null ? null : Math.max(0, userCap - usageUser.used);
  const remainingBiz =
    bizCap == null ? null : Math.max(0, bizCap - usageBiz.used);

  if (userCap != null && usageUser.used + units > userCap) {
    return {
      ok: false,
      reason: "UserCapExceeded",
      remainingUser,
      remainingBiz,
      capUser: userCap,
      usedUser: usageUser.used,
      period,
      period_key: usageUser.key,
    };
  }

  if (bizCap != null && usageBiz.used + units > bizCap) {
    return {
      ok: false,
      reason: "BusinessCapExceeded",
      remainingUser,
      remainingBiz,
      capBiz: bizCap,
      usedBiz: usageBiz.used,
      period,
      period_key: usageBiz.key,
    };
  }

  return {
    ok: true,
    remainingUser,
    remainingBiz,
    capUser: userCap,
    capBiz: bizCap,
    usedUser: usageUser.used,
    usedBiz: usageBiz.used,
    period,
    period_key: usageUser.key,
  };
}

/** Record successful usage for both user + business */
async function recordSuccessUsage(
  businessId,
  userId,
  featureCode,
  period,
  delta
) {
  if (!delta || delta <= 0) return;
  await Promise.all([
    MessageQuota.recordUsage({
      businessId,
      userId,
      featureCode,
      period,
      delta,
    }),
    MessageQuota.recordUsage({
      businessId,
      userId: null,
      featureCode,
      period,
      delta,
    }),
  ]);
}

/** POST /api/messages/single  — supports multiple contents + files*/
exports.sendSingleMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let { recipient, contents } = req.body || {};
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

    const user = await User.findByPk(req.user.id);
    if (!user)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await messageService.sendSingleMessage(
      bizId,
      recipient,
      contents,
      files,
      { user }
    );

    if (result && result.success === false) {
      return res.status(result.status || 400).json(result);
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.status) {
      return res
        .status(err.status)
        .json({ success: false, message: err.message, data: err.data });
    }
    console.error("sendSingleMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

/** POST /api/messages/bulk — supports multiple contents + files */
exports.sendBulkMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let { globalMessages, recipientsData } = req.body || {};

    if (typeof globalMessages === "string") {
      try {
        globalMessages = JSON.parse(globalMessages);
      } catch {
        // allow single string as a single message
        globalMessages = [globalMessages];
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

    const user = await User.findByPk(req.user.id);
    if (!user)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await messageService.sendBulkMessage(
      bizId,
      globalMessages,
      recipientsData,
      globalFiles,
      {
        /* mediaUrls optional via opts.mediaUrls */
      }
    );

    if (result && result.success === false) {
      return res.status(result.status || 400).json(result);
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.status) {
      return res
        .status(err.status)
        .json({ success: false, message: err.message, data: err.data });
    }
    console.error("sendBulkMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

/** POST /api/messages/sendGroup — send message to WhatsApp group */
exports.sendGroupMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    if (!bizId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    let { groupId, contents } = req.body || {};
    if (!groupId)
      return res
        .status(400)
        .json({ success: false, message: "Group ID is required" });
    if (!contents)
      return res
        .status(400)
        .json({ success: false, message: "Message content is required" });

    contents = Array.isArray(contents) ? contents : [contents];
    const files = req.files || [];

    const user = await User.findByPk(req.user.id);
    if (!user)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await messageService.sendGroupMessage(
      bizId,
      groupId,
      contents,
      files,
      { user }
    );

    if (result && result.success === false) {
      return res.status(result.status || 400).json(result);
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.status) {
      return res
        .status(err.status)
        .json({ success: false, message: err.message, data: err.data });
    }
    console.error("sendGroupMessage error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

// ============================================================================
// NEW API ENDPOINTS (simplified request/response formats per documentation)
// ============================================================================

/** POST /api/messages/send - Send single text message */
exports.apiSendMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    const userId = req.user?.id;
    const { phone, message } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required"
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message text is required"
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Create message record
    const messageRecord = await Message.create({
      business_id: bizId,
      user_id: userId,
      phone: phone,
      message: message,
      status: "pending",
      message_type: "single",
      sent_at: new Date()
    });

    // Use existing service with simplified params
    const result = await messageService.sendSingleMessage(
      bizId,
      phone,
      [message],
      [],
      { user }
    );

    // Update message record based on result
    if (result && result.success === false) {
      await messageRecord.update({
        status: "failed",
        error_message: result.message || "Failed to send message",
        failed_at: new Date()
      });
      
      return res.status(result.status || 400).json({
        success: false,
        error: result.message || "Failed to send message"
      });
    }

    // Update as sent
    await messageRecord.update({
      status: "sent",
      whatsapp_message_id: result.whatsapp_message_id || null
    });

    // Format response per API documentation
    return res.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: result.whatsapp_message_id || null,
      status: "sent",
      phone: phone,
      message: message,
      account: {
        id: bizId,
        name: user.business?.business_name || null,
        phone: user.business?.phone || null
      }
    });
  } catch (err) {
    console.error("apiSendMessage error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};

/** POST /api/messages/send-media - Send media message */
exports.apiSendMediaMessage = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    const userId = req.user?.id;
    const { phone, message } = req.body;
    const media = req.file;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required"
      });
    }

    if (!media) {
      return res.status(400).json({
        success: false,
        error: "Media file is required"
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Create message record
    const messageRecord = await Message.create({
      business_id: bizId,
      user_id: userId,
      phone: phone,
      message: message || "",
      status: "pending",
      message_type: "single",
      media_type: media.mimetype,
      sent_at: new Date()
    });

    // Use existing service
    const contents = message ? [message] : [];
    const result = await messageService.sendSingleMessage(
      bizId,
      phone,
      contents,
      [media],
      { user }
    );

    // Update message record based on result
    if (result && result.success === false) {
      await messageRecord.update({
        status: "failed",
        error_message: result.message || "Failed to send media",
        failed_at: new Date()
      });
      
      return res.status(result.status || 400).json({
        success: false,
        error: result.message || "Failed to send media"
      });
    }

    // Update as sent
    await messageRecord.update({
      status: "sent",
      whatsapp_message_id: result.whatsapp_message_id || null
    });

    // Format response per API documentation
    return res.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: result.whatsapp_message_id || null,
      status: "sent",
      phone: phone,
      message: message || "",
      media_type: media.mimetype,
      account: {
        id: bizId,
        name: user.business?.business_name || null
      }
    });
  } catch (err) {
    console.error("apiSendMediaMessage error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};

/** POST /api/messages/bulk - Send bulk messages */
exports.apiSendBulkMessages = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    let { phones, message } = req.body;
    const media = req.file;

    // Parse phones if it's a string
    if (typeof phones === "string") {
      try {
        phones = JSON.parse(phones);
      } catch {
        return res.status(400).json({
          success: false,
          error: "Invalid phones format. Expected JSON array."
        });
      }
    }

    if (!Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({
        success: false,
        error: "phones array is required"
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message text is required"
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Convert phones array to recipientsData format
    const recipientsData = phones.map(phone => ({ phone }));
    const files = media ? [media] : [];

    const result = await messageService.sendBulkMessage(
      bizId,
      [message],
      recipientsData,
      files,
      {}
    );

    if (result && result.success === false) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.message || "Failed to send bulk messages"
      });
    }

    // Format response per API documentation
    const results = recipientsData.map((recipient, idx) => ({
      phone: recipient.phone,
      status: "sent",
      message_id: result.message_id ? result.message_id + idx : null,
      whatsapp_message_id: null
    }));

    return res.json({
      success: true,
      bulk_message_id: result.bulk_message_id || null,
      total_recipients: phones.length,
      successful: result.successful || phones.length,
      failed: result.failed || 0,
      results: results,
      account: {
        id: bizId,
        name: user.business?.business_name || null,
        phone: user.business?.phone || null
      }
    });
  } catch (err) {
    console.error("apiSendBulkMessages error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};

/** POST /api/messages/group - Send group message(s) */
exports.apiSendGroupMessages = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    let { groupId, message, messages } = req.body;
    const attachments = req.files || [];

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: "Group ID is required"
      });
    }

    // Handle both single message and multiple messages
    let contents = [];
    if (messages) {
      // Parse if string
      if (typeof messages === "string") {
        try {
          contents = JSON.parse(messages);
        } catch {
          contents = [messages];
        }
      } else if (Array.isArray(messages)) {
        contents = messages;
      } else {
        contents = [messages];
      }
    } else if (message) {
      contents = [message];
    }

    if (contents.length === 0 && attachments.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message content or attachments required"
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const result = await messageService.sendGroupMessage(
      bizId,
      groupId,
      contents,
      attachments,
      { user }
    );

    if (result && result.success === false) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.message || "Failed to send group message"
      });
    }

    // Format response for multiple messages
    const results = contents.map((msg, idx) => ({
      message: msg,
      type: attachments.length > 0 && idx === contents.length - 1 ? "media" : "text",
      status: "sent",
      whatsapp_message_id: null,
      attachment: attachments.length > 0 && idx === contents.length - 1 
        ? attachments.map(f => f.originalname).join(", ") 
        : null
    }));

    return res.json({
      success: true,
      group_id: groupId,
      total_messages: contents.length,
      successful: contents.length,
      failed: 0,
      attachments_count: attachments.length,
      results: results.length > 1 ? results : undefined,
      whatsapp_message_id: results.length === 1 ? results[0].whatsapp_message_id : undefined,
      status: results.length === 1 ? "sent" : undefined,
      message: results.length === 1 ? contents[0] : undefined,
      account: {
        id: bizId,
        name: user.business?.business_name || null
      }
    });
  } catch (err) {
    console.error("apiSendGroupMessages error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};

/** GET /api/messages - Get message history with pagination */
exports.apiGetMessages = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    const {
      page = 1,
      limit = 50,
      status,
      phone,
      startDate,
      endDate
    } = req.query;

    // Validate and cap limit
    const perPage = Math.min(parseInt(limit) || 50, 100);
    const currentPage = parseInt(page) || 1;
    const offset = (currentPage - 1) * perPage;

    // Build where clause
    const where = { business_id: bizId };
    
    if (status) {
      where.status = status;
    }
    
    if (phone) {
      where.phone = { [Op.like]: `%${phone}%` };
    }
    
    if (startDate || endDate) {
      where.sent_at = {};
      if (startDate) {
        where.sent_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.sent_at[Op.lte] = end;
      }
    }

    // Get messages with pagination
    const { count, rows } = await Message.findAndCountAll({
      where,
      limit: perPage,
      offset,
      order: [['sent_at', 'DESC']],
      attributes: [
        'id', 'phone', 'message', 'status', 'whatsapp_message_id',
        'sent_at', 'delivered_at', 'failed_at', 'error_message'
      ]
    });

    const totalPages = Math.ceil(count / perPage);

    // Format messages
    const messages = rows.map(msg => ({
      id: msg.id,
      phone: msg.phone,
      message: msg.message || "",
      status: msg.status,
      whatsapp_message_id: msg.whatsapp_message_id,
      sent_at: msg.sent_at,
      delivered_at: msg.delivered_at,
      failed_at: msg.failed_at,
      error_message: msg.error_message
    }));
    
    return res.json({
      success: true,
      messages,
      pagination: {
        current_page: currentPage,
        total_pages: totalPages,
        total_messages: count,
        messages_per_page: perPage
      }
    });
  } catch (err) {
    console.error("apiGetMessages error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};

/** GET /api/messages/status/:status - Get messages by status */
exports.apiGetMessagesByStatus = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    const { status } = req.params;

    const validStatuses = ["sent", "delivered", "failed", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    // Get messages by status
    const messages = await Message.findAll({
      where: {
        business_id: bizId,
        status: status
      },
      order: [['sent_at', 'DESC']],
      limit: 100,
      attributes: [
        'id', 'phone', 'message', 'status', 'whatsapp_message_id',
        'sent_at', 'delivered_at', 'failed_at', 'error_message'
      ]
    });

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      phone: msg.phone,
      message: msg.message || "",
      status: msg.status,
      error_message: msg.error_message,
      sent_at: msg.sent_at,
      failed_at: msg.failed_at
    }));
    
    return res.json({
      success: true,
      status: status,
      count: messages.length,
      messages: formattedMessages
    });
  } catch (err) {
    console.error("apiGetMessagesByStatus error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};

/** GET /api/messages/failed - Get failed messages */
exports.apiGetFailedMessages = async (req, res) => {
  try {
    const bizId = req.user?.business_id;
    const { page = 1, limit = 50 } = req.query;

    // Validate and cap limit
    const perPage = Math.min(parseInt(limit) || 50, 100);
    const currentPage = parseInt(page) || 1;
    const offset = (currentPage - 1) * perPage;

    // Get failed messages with pagination
    const { count, rows } = await Message.findAndCountAll({
      where: {
        business_id: bizId,
        status: "failed"
      },
      limit: perPage,
      offset,
      order: [['failed_at', 'DESC']],
      attributes: [
        'id', 'phone', 'message', 'error_message',
        'sent_at', 'failed_at'
      ]
    });

    const totalPages = Math.ceil(count / perPage);

    const failedMessages = rows.map(msg => ({
      id: msg.id,
      phone: msg.phone,
      message: msg.message || "",
      error_message: msg.error_message,
      sent_at: msg.sent_at,
      failed_at: msg.failed_at
    }));
    
    return res.json({
      success: true,
      failed_messages: failedMessages,
      total_failed: count,
      pagination: {
        current_page: currentPage,
        total_pages: totalPages
      }
    });
  } catch (err) {
    console.error("apiGetFailedMessages error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Server error"
    });
  }
};
