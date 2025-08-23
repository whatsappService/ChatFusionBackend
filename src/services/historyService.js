const axios = require("axios");
const Business = require("../models/business");
const logger = require("../utils/logger");
require("dotenv").config();

const generateExcelReport = require("../utils/excelGenerator");

// Use the WHATSAPP_SERVICE_URL from the environment variables.
// It should be defined in your .env file.
const API_BASE = process.env.WHATSAPP_SERVICE_URL;
console.log(API_BASE);

if (!API_BASE) {
  throw new Error(
    "WHATSAPP_SERVICE_URL is not defined in the environment variables"
  );
}

/**
 * Fetch user messages history for a given business.
 * @param {string} userId - The authenticated user ID.
 * @param {Object} queryParams - Query parameters (e.g., startDate, endDate)
 * @returns {Promise<Object>} API response data.
 */
exports.fetchUserMessages = async (userId, queryParams) => {
  // Look up the business record for this user
  const business = await Business.findOne({ where: { id: userId } });
  if (!business || !business.api_key) {
    throw new Error("API key not found for this business");
  }
  logger.info("Business API key:", business.api_key);
  const url = `${API_BASE}/history/user-messages`;
  logger.info("Fetching user messages from:", url);

  const response = await axios.get(url, {
    params: queryParams,
    headers: {
      "x-api-key": business.api_key,
    },
  });

  logger.info("Fetched user messages:", response.data);
  return response.data;
};

/**
 * Fetch history between two dates for a given business.
 */
exports.fetchHistoryBetweenDates = async (userId, queryParams) => {
  const business = await Business.findOne({ where: { id: userId } });
  if (!business || !business.api_key) {
    throw new Error("API key not found for this business");
  }

  let url = `${API_BASE}/history/user-history`;

  // ✅ Extract query params and remove undefined values
  const { startDate, endDate } = queryParams;
  const queryParamsArray = [];

  if (startDate) {
    queryParamsArray.push(`startDate=${encodeURIComponent(startDate)}`);
  }
  if (endDate) {
    queryParamsArray.push(`endDate=${encodeURIComponent(endDate)}`);
  }

  // ✅ Append query params if any exist
  if (queryParamsArray.length > 0) {
    url += `?${queryParamsArray.join("&")}`;
  }

  console.log("Constructed URL:", url);

  const response = await axios.get(url, {
    headers: {
      "x-api-key": business.api_key,
    },
  });

  logger.info("Fetched history between dates:", response.data);
  return response.data;
};

/**
 * Fetch messages by a specific history ID for a given business and generate an Excel file.
 * @param {string} userId - The authenticated user ID.
 * @param {string} historyId - The ID of the history record.
 * @returns {Promise<Buffer>} - A promise that resolves to an Excel file as a buffer.
 */
exports.fetchMessagesByHistory = async (userId, historyId) => {
  const business = await Business.findOne({ where: { id: userId } });
  if (!business || !business.api_key) {
    throw new Error("API key not found for this business");
  }
  const url = `${API_BASE}/history/messages-by-history/${historyId}`;
  logger.info("Fetching messages by history from:", url);

  const response = await axios.get(url, {
    headers: { "x-api-key": business.api_key },
  });
  logger.info("Fetched messages by history:", response.data);

  if (!response.data || !Array.isArray(response.data.messages)) {
    throw new Error("Fetched data does not contain a valid messages array");
  }

  const buffer = await generateExcelReport(response.data);
  return buffer;
};
