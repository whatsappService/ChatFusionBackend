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

/**
 * Send bulk messages via ChatFusion
 * @param {number} businessId - The business ID of the sender.
 * @param {Array<string>} globalMessages - Array of global messages.
 * @param {Array<Object>} recipientsData - Array of recipient objects with structure:
 *   { recipient: "phoneNumber", personalMessages: [..], personalAttachments: [..] }
 * @param {Array} globalFiles - Array of global file objects (from multer).
 * @param {Array} personalFiles - Array of personal file objects (from multer).
 * @returns {Object} API response.
 */
exports.sendBulkMessage = async (
  businessId,
  globalMessages,
  recipientsData,
  globalFiles,
  personalFiles
) => {
  try {
    // Get the business API key
    const business = await Business.findOne({ where: { id: businessId } });
    if (!business || !business.api_key) {
      throw new Error("API key not found for this business");
    }


    // Prepare FormData using the "form-data" package
    const formData = new FormData();
    formData.append("globalMessages", JSON.stringify(globalMessages));
    formData.append("recipientsData", JSON.stringify(recipientsData));

    // Append global files
    if (globalFiles && globalFiles.length > 0) {
      globalFiles.forEach((file) => {
        if (file.buffer) {
          formData.append("globalFiles", file.buffer, {
            filename: file.originalname,
          });
        } else {
          // Fallback: if no buffer, append file as is
          formData.append("globalFiles", file);
        }
      });
    }

    // Append personal files
    if (personalFiles && personalFiles.length > 0) {
      personalFiles.forEach((file) => {
        if (file.buffer) {
          formData.append("personalFiles", file.buffer, {
            filename: file.originalname,
          });
        } else {
          formData.append("personalFiles", file);
        }
      });
    }


    // Send the request to ChatFusion Bulk API endpoint
    const chatFusionResponse = await axios.post(
      "https://chatfusion.murraltd.com/api/messaging/sendBulk",
      formData,
      {
        headers: {
          "x-api-key": business.api_key,
          ...formData.getHeaders(),
        },
      }
    );


    if (
      !chatFusionResponse.data.success ||
      chatFusionResponse.data.failedCount > 0
    ) {
      const failedMessages = chatFusionResponse.data.data.failedMessages || [];
      return {
        success: false,
        message: "Bulk message not sent",
        failedMessages,
      };
    }

    return { success: true, message: chatFusionResponse.data.message };
  } catch (error) {
    console.error(
      "❌ Error in bulk message service:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || "Failed to send bulk message"
    );
  }
};
