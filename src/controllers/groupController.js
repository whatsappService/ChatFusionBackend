const groupService = require("../services/groupService");

/**
 * GET /api/group/get-groups
 * Get WhatsApp groups from ChatFusion API
 */
exports.getGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const groups = await groupService.getWhatsAppGroups(userId);
    
    res.json({
      success: true,
      message: "Groups retrieved successfully",
      data: groups
    });
  } catch (error) {
    console.error("❌ Error in getGroups controller:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve groups",
      error: "Group Controller Error",
      source: "Group Controller"
    });
  }
};

/**
 * POST /api/group/send-message
 * Send message to a WhatsApp group
 */
exports.sendGroupMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId, contents } = req.body;
    const files = req.files || [];

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group ID is required"
      });
    }

    if (!contents || (Array.isArray(contents) && contents.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Message content is required"
      });
    }

    const result = await groupService.sendGroupMessage(userId, groupId, contents, files);
    
    res.json({
      success: true,
      message: "Group message sent successfully",
      data: result
    });
  } catch (error) {
    console.error("❌ Error in sendGroupMessage controller:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send group message",
      error: "Group Controller Error",
      source: "Group Controller"
    });
  }
};
