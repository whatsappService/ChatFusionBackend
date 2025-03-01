const axios = require("axios");
const FormData = require("form-data");
const Business = require("../models/business");

/**
 * Send a single message via ChatFusion
 * @param {number} businessId - ID of the business
 * @param {string} recipient - Recipient's phone number
 * @param {Array<string>} contents - List of message contents
 * @param {Array} files - List of file buffers (if any)
 * @returns {Object} API Response
 */
exports.sendSingleMessage = async (businessId, recipient, contents, files) => {
  try {
    // ✅ Get the business API key
    const business = await Business.findOne({ where: { id: businessId } });

    if (!business || !business.api_key) {
      throw new Error("API key not found for this business");
    }

    console.log("🔑 Using API Key:", business.api_key);

    // ✅ Validate Recipient Number
    if (!/^\d+$/.test(recipient)) {
      throw new Error("Invalid recipient phone number format.");
    }

    // ✅ Prepare FormData for the request
    const formData = new FormData();
    formData.append("recipient", recipient);

    // ✅ Ensure `contents` is an array
    if (!Array.isArray(contents)) {
      contents = [contents];
    }

    // ✅ Append each message separately
    contents.forEach((msg) => {
      formData.append("contents", msg);
    });

    if (files && files.length > 0) {
      files.forEach((file) => {
        formData.append("files", file.buffer, { filename: file.originalname });
      });
    }

    console.log("📤 Forwarding request to ChatFusion...");

    // ✅ Send the request to ChatFusion API
    const chatFusionResponse = await axios.post(
      "https://chatfusion.murraltd.com/api/messaging/send",
      formData,
      {
        headers: {
          "x-api-key": business.api_key,
          ...formData.getHeaders(),
        },
      }
    );

    console.log("✅ ChatFusion Response:", chatFusionResponse.data);

    // ✅ Handle success and failure cases
    if (
      !chatFusionResponse.data.success ||
      chatFusionResponse.data.failedCount > 0
    ) {
      const failedMessages = chatFusionResponse.data.data.failedMessages || [];

      return {
        success: false,
        message: "Message not sent",
        failedMessages, // Return detailed errors
      };
    }

    return { success: true, message: chatFusionResponse.data.message };
  } catch (error) {
    console.error(
      "❌ Error in messageService:",
      error.response?.data || error.message
    );
    throw new Error(error.response?.data?.message || "Failed to send message");
  }
};
