const axios = require("axios");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();

const { User, Business } = require("../models/associations");

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const CHATFUSION_RESET_API_KEY_URL =
  "https://chatfusion.murraltd.com/api/auth/reset-api-key";
const CHATFUSION_UPDATE_API_KEY_URL =
  "https://chatfusion.murraltd.com/api/auth/update-api-key";
const CHATFUSION_STATUS_URL =
  "https://chatfusion.murraltd.com/api/whatsapp/status";
const CHATFUSION_CONNECT_URL =
  "https://chatfusion.murraltd.com/api/whatsapp/connect";
const CHATFUSION_CHECK_NUMBER_URL =
  process.env.CHATFUSION_CHECK_NUMBER_URL ||
  "https://chatfusion.murraltd.com/api/whatsapp/check-whatsapp-number";

// New: endpoint to disconnect an active WhatsApp session
const CHATFUSION_DISCONNECT_URL =
  process.env.CHATFUSION_DISCONNECT_URL ||
  "https://chatfusion.murraltd.com/api/whatsapp/disconnect";


/**
 * ✅ Get API Key for a user's business
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
 * ✅ Get API Key for a business by business ID
 */
exports.getApiKeyByBusinessId = async (businessId) => {
  try {
    const business = await Business.findByPk(businessId, {
      attributes: ["api_key"],
    });
    return business?.api_key || null;
  } catch (error) {
    console.error("❌ Error fetching API key by business ID:", error);
    throw error;
  }
};

/**
 * ✅ Fetch WhatsApp Account Info
 */
exports.fetchWhatsappAccountInfo = async (apiKey) => {
  try {
    if (!WHATSAPP_SERVICE_URL) {
      throw new Error(
        "WHATSAPP_SERVICE_URL is not defined in environment variables."
      );
    }

    const response = await axios.get(`${WHATSAPP_SERVICE_URL}/auth/profile`, {
      headers: { "x-api-key": apiKey },
    });

    return response.data;
  } catch (error) {
    console.error(
      "❌ Error calling WhatsApp service:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to fetch WhatsApp account info"
    );
  }
};

/**
 * ✅ Reset Business API Key (Requires Password)
 */
exports.resetBusinessApiKey = async (userId, password) => {
  try {
    const user = await User.findByPk(userId, {
      include: { model: Business, as: "business" },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Invalid password");
    }

    const oldApiKey = user.business.api_key;
    console.log("🔹 Old API Key:", oldApiKey);

    // ✅ Call ChatFusion API with the old API key in headers
    const response = await axios.post(
      CHATFUSION_RESET_API_KEY_URL,
      {}, // Empty request body
      {
        headers: {
          "x-api-key": oldApiKey,
        },
      }
    );

    const newApiKey = response.data.apiKey; // ✅ Extract new API key

    if (!newApiKey) {
      throw new Error("Invalid response: New API key not received");
    }

    console.log("✅ New API Key received:", newApiKey);

    // ✅ Update the business API key in the database
    await user.business.update({ api_key: newApiKey });

    return { success: true, apiKey: newApiKey };
  } catch (error) {
    console.error(
      "❌ Error resetting API Key in ChatFusion:",
      error.response?.data || error.message
    );
    throw new Error("Failed to reset API Key in ChatFusion");
  }
};

/**
 * ✅ Update Business API Key (Requires Password)
 */
exports.updateBusinessApiKey = async (userId, apiKey, password) => {
  try {
    const user = await User.findByPk(userId, {
      include: { model: Business, as: "business" },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Invalid password");
    }

    // ✅ Update API Key in Business Table
    await user.business.update({ api_key: apiKey });

    return { success: true, apiKey };
  } catch (error) {
    console.error("❌ Error updating API Key:", error);
    throw new Error("Failed to update API Key");
  }
};

/**
 * ✅ Fetch WhatsApp Authentication Status (Now includes x-api-key)
 */
exports.fetchWhatsAppStatus = async (userId) => {
  try {
    const apiKey = await this.getApiKeyByUser(userId);
    if (!apiKey) {
      throw new Error("API Key not found.");
    }

    const response = await axios.get(CHATFUSION_STATUS_URL, {
      headers: { "x-api-key": apiKey },
    });

    return response.data;
  } catch (error) {
    console.error(
      "❌ Error fetching WhatsApp status:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch WhatsApp status");
  }
};

exports.connectToWhatsApp = async (userId) => {
  try {
    const apiKey = await this.getApiKeyByUser(userId);
    if (!apiKey) {
      throw new Error("API Key not found.");
    }

    const response = await axios.get(
      CHATFUSION_CONNECT_URL, // Correct URL

      {
        headers: { "x-api-key": apiKey }, // Send API Key in header
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "❌ Error connecting to WhatsApp:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to connect to WhatsApp"
    );
  }
};

/**
 * Check if a phone number is registered on WhatsApp using ChatFusion API.
 *
 * @param {number} userId - The id of the authenticated user.
 * @param {string} phoneNumber - The phone number to check.
 * @returns {Object} - The response from the ChatFusion API.
 */
exports.checkWhatsAppNumber = async (userId, phoneNumber) => {
  try {
    // Retrieve the API key associated with the user's business
    const apiKey = await this.getApiKeyByUser(userId);
    if (!apiKey) {
      throw new Error("API key not found for this business.");
    }

    // Build the URL using the query parameter 'recipient'
    const url = `${CHATFUSION_CHECK_NUMBER_URL}?phone=${encodeURIComponent(
      phoneNumber
    )}`;

    // Call the ChatFusion API using GET request
    const response = await axios.get(url, {
      headers: { "x-api-key": apiKey },
    });

    return response.data;
  } catch (error) {
    console.error(
      "Error checking WhatsApp number:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to check WhatsApp number"
    );
  }
};
/**
 * Check if a phone number is registered on WhatsApp using ChatFusion API.
 *
 * @param {number} userId - The id of the authenticated user.
 * @param {string} phoneNumber - The phone number to check.
 * @returns {Object} - The response from the ChatFusion API.
 */
// exports.checkWhatsAppNumber = async (userId, phoneNumber) => {
//   try {
//     // Retrieve the API key associated with the user's business
//     const apiKey = await this.getApiKeyByUser(userId);
//     if (!apiKey) {
//       throw new Error("API key not found for this business.");
//     }

//     // Build the URL using the query parameter 'recipient'
//     const url = `${CHATFUSION_CHECK_NUMBER_URL}?phone=${encodeURIComponent(
//       phoneNumber
//     )}`;

//     // Call the ChatFusion API using GET request
//     const response = await axios.get(url, {
//       headers: { "x-api-key": apiKey },
//     });

//     return response.data;
//   } catch (error) {
//     console.error(
//       "Error checking WhatsApp number:",
//       error.response?.data || error.message
//     );
//     throw new Error(
//       error.response?.data?.message || "Failed to check WhatsApp number"
//     );
//   }
// };

/**
 * Disconnect the WhatsApp client associated with a business.
 *
 * This helper looks up the API key for the given user and issues a
 * POST request to the ChatFusion service to disconnect the account.
 * An optional accountId may be provided to explicitly target a
 * specific WhatsApp account (e.g., primary vs alternative).  If
 * omitted, the service will disconnect whichever account is active.
 *
 * @param {number} userId - the authenticated user's id
 * @param {string} [accountId] - optional WhatsApp account id to disconnect
 * @returns {Object} - the response from the ChatFusion API
 */
exports.disconnectFromWhatsApp = async (userId, accountId) => {
  try {
    const apiKey = await this.getApiKeyByUser(userId);
    if (!apiKey) {
      throw new Error("API key not found for this business.");
    }
    const body = {};
    if (accountId) {
      body.accountId = accountId;
    }
    const response = await axios.post(CHATFUSION_DISCONNECT_URL, body, {
      headers: { "x-api-key": apiKey },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Error disconnecting WhatsApp:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to disconnect WhatsApp"
    );
  }
};
