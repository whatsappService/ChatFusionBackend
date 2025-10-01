const axios = require("axios");
const { User, Business } = require("../models/associations");

const CHATFUSION_BASE_URL = process.env.CHATFUSION_BASE_URL || "https://chatfusion.murraltd.com/api";
const CHATFUSION_GET_GROUPS_URL = process.env.CHATFUSION_GET_GROUPS_URL || `${CHATFUSION_BASE_URL}/group/get-groups`;

/**
 * Get API Key for a user's business
 */
exports.getApiKeyByUser = async (userId) => {
  try {
    const user = await User.findByPk(userId, {
      include: {
        model: Business,
        as: "business",
        attributes: ["api_key"],
      },
    });
    return user?.business?.api_key || null;
  } catch (error) {
    console.error("❌ Error fetching API key:", error);
    throw error;
  }
};

/**
 * Get WhatsApp groups from ChatFusion API
 */
exports.getWhatsAppGroups = async (userId) => {
  try {
    const apiKey = await this.getApiKeyByUser(userId);
    if (!apiKey) {
      throw new Error("API key not found for this business.");
    }

    const response = await axios.get(CHATFUSION_GET_GROUPS_URL, {
      headers: { "x-api-key": apiKey },
    });

    return response.data;
  } catch (error) {
    console.error(
      "❌ Error fetching WhatsApp groups from ChatFusion API:",
      error.response?.data || error.message
    );
    console.error("❌ Error status:", error.response?.status);
    console.error("❌ Error code:", error.code);
    
    if (error.response?.status === 401) {
      throw new Error("WhatsApp Groups Error: Unauthorized - Invalid API key or expired credentials");
    } else if (error.response?.status === 404 || error.response?.status === 400) {
      // Return empty groups array instead of throwing error when service is unavailable
      return {
        success: true,
        message: "WhatsApp service is currently unavailable. Please ensure your WhatsApp account is connected.",
        data: [],
        groups: [],
        total: 0
      };
    } else if (error.response?.status >= 500) {
      throw new Error("WhatsApp Groups Error: ChatFusion server error - External service is down");
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      // Return empty groups array instead of throwing error when service is unavailable
      return {
        success: true,
        message: "WhatsApp service is currently unavailable. Please ensure your WhatsApp account is connected.",
        data: [],
        groups: [],
        total: 0
      };
    } else {
      // For any other error, also return empty groups instead of throwing
      return {
        success: true,
        message: "WhatsApp service is currently unavailable. Please ensure your WhatsApp account is connected.",
        data: [],
        groups: [],
        total: 0
      };
    }
  }
};

/**
 * Send message to a WhatsApp group
 */
exports.sendGroupMessage = async (userId, groupId, contents, files = []) => {
  try {
    const apiKey = await this.getApiKeyByUser(userId);
    if (!apiKey) {
      throw new Error("API key not found for this business.");
    }

    const CHATFUSION_SEND_GROUP_URL = process.env.CHATFUSION_SEND_GROUP_URL || `${CHATFUSION_BASE_URL}/messaging/sendGroup`;

    const form = new FormData();
    form.append("groupId", groupId);
    
    if (Array.isArray(contents)) {
      contents.forEach((content, index) => {
        form.append(`contents[${index}]`, content);
      });
    } else {
      form.append("contents[0]", contents);
    }

    // Add files if any
    if (Array.isArray(files) && files.length > 0) {
      files.forEach((file, index) => {
        form.append("files", file.buffer, { filename: file.originalname });
      });
    }

    const response = await axios.post(CHATFUSION_SEND_GROUP_URL, form, {
      headers: { "x-api-key": apiKey, ...form.getHeaders() },
    });

    return response.data;
  } catch (error) {
    console.error(
      "❌ Error sending group message via ChatFusion API:",
      error.response?.data || error.message
    );
    
    if (error.response?.status === 401) {
      throw new Error("Group Message Error: Unauthorized - Invalid API key or expired credentials");
    } else if (error.response?.status === 404) {
      throw new Error("Group Message Error: WhatsApp service is currently unavailable. Please ensure your WhatsApp account is connected and try again.");
    } else if (error.response?.status >= 500) {
      throw new Error("Group Message Error: ChatFusion server error - External service is down");
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error("Group Message Error: WhatsApp service is currently unavailable. Please ensure your WhatsApp account is connected and try again.");
    } else {
      throw new Error(`Group Message Error: ${error.response?.data?.message || error.message || 'Unknown error occurred'}`);
    }
  }
};
