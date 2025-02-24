const axios = require("axios");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const dotenv = require("dotenv");
dotenv.config();

const { User, Business } = require("../models/associations");

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
const CHATFUSION_RESET_API_KEY_URL =
  "https://chatfusion.murraltd.com/api/auth/reset-api-key";
const CHATFUSION_UPDATE_API_KEY_URL =
  "https://chatfusion.murraltd.com/api/auth/update-api-key";

// ✅ Get API Key for a user's business
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
    console.error("Error fetching API key:", error);
    throw error;
  }
};

// ✅ Fetch WhatsApp Account Info
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
      "Error calling WhatsApp service:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to fetch WhatsApp account info"
    );
  }
};

exports.resetBusinessApiKey = async (userId, password) => {
  const user = await User.findByPk(userId, {
    include: { model: Business, as: "business" },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error("Invalid password");
  }

  const oldApiKey = user.business.api_key; // ✅ Store the old API key

  console.log("user: ", user);

  console.log("🔹 Old API Key:", oldApiKey);

  try {
    // ✅ Call ChatFusion API with the old API key in headers
    const response = await axios.post(
      CHATFUSION_RESET_API_KEY_URL,
      {}, // Empty request body
      {
        headers: {
          "x-api-key": oldApiKey, // ✅ Send old API key for authentication
        },
      }
    );
    console.log("response: ",response);
    
    const newApiKey = response.data.apiKey; // ✅ Extract the new API key from response

    if (!newApiKey) {
      throw new Error("Invalid response: New API key not received");
    }

    console.log("✅ New API Key received:", newApiKey);

    // ✅ Update the business API key in the database
    await user.business.update({ api_key: newApiKey });

    return { success: true, apiKey: newApiKey }; // ✅ Return the new API Key
  } catch (error) {
    console.error(
      "❌ Error resetting API Key in ChatFusion:",
      error.response?.data || error.message
    );
    throw new Error("Failed to reset API Key in ChatFusion");
  }
};

// ✅ Update API Key (Requires password verification)
exports.updateBusinessApiKey = async (userId, apiKey, password) => {
  const user = await User.findByPk(userId, {
    include: { model: Business, as: "business" },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error("Invalid password");
  }

  await user.business.update({ api_key: apiKey });

  try {
    await axios.post(
      CHATFUSION_UPDATE_API_KEY_URL,
      {},
      {
        headers: { "x-api-key": apiKey },
      }
    );
  } catch (error) {
    console.error(
      "Error updating API Key in ChatFusion:",
      error.response?.data || error.message
    );
    throw new Error("Failed to update API Key in ChatFusion");
  }

  return apiKey;
};
