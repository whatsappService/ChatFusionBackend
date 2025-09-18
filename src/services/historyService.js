// src/services/historyService.js
"use strict";

const axios = require("axios");
const { User, Business } = require("../models/associations");
const logger = require("../utils/logger");
const generateExcelReport = require("../utils/excelGenerator");
require("dotenv").config();

const API_BASE = process.env.WHATSAPP_SERVICE_URL;
const needBase = () => {
  if (!API_BASE) throw new Error("WHATSAPP_SERVICE_URL is not defined");
};

if (!API_BASE) throw new Error("WHATSAPP_SERVICE_URL is not defined");

/** Fetch user messages history for a given user’s business. */
exports.fetchUserMessages = async (userId, queryParams) => {
  needBase();
  const user = await User.findByPk(userId, {
    include: { model: Business, as: "business" },
  });
  const apiKey = user?.business?.api_key;
  if (!apiKey) throw new Error("API key not found for this business");
  const url = `${API_BASE}/history/user-messages`;

  logger.info("Fetching user messages from:", url);
  const response = await axios.get(url, {
    params: queryParams,
    headers: { "x-api-key": apiKey },
  });
  logger.info("Fetched user messages:", response.data);
  return response.data;
};

/** Fetch history between two dates for a given user's business with pagination. */
exports.fetchHistoryBetweenDates = async (userId, queryParams) => {
  console.log("fetchHistoryBetweenDates");

  const user = await User.findByPk(userId, {
    include: { model: Business, as: "business" },
  });
  console.log(user);

  const apiKey = user?.business?.api_key;
  if (!apiKey) throw new Error("API key not found for this business");
  console.log("API key:", apiKey);

  // Extract pagination parameters
  const { page = 1, limit = 10, ...otherParams } = queryParams;
  
  // Convert page and limit to offset for the external API
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare parameters for the external API
  const apiParams = {
    ...otherParams,
    offset: offset,
    limit: parseInt(limit)
  };

  const url = `${API_BASE}/history/user-history`;
  console.log("Fetching history between dates from:", url, "with params:", apiParams);

  const response = await axios.get(url, {
    params: apiParams,
    headers: { "x-api-key": apiKey },
  });
  
  logger.info("Fetched history between dates:", response.data);
  
  // Add pagination metadata to the response
  const data = response.data;
  const totalItems = data.total || data.count || 0;
  const totalPages = Math.ceil(totalItems / parseInt(limit));
  
  return {
    ...data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1
    }
  };
};

/** Fetch messages by a specific history ID and generate an Excel file. */
exports.fetchMessagesByHistory = async (userId, historyId) => {
  const user = await User.findByPk(userId, {
    include: { model: Business, as: "business" },
  });
  const apiKey = user?.business?.api_key;
  if (!apiKey) throw new Error("API key not found for this business");

  const url = `${API_BASE}/history/messages-by-history/${historyId}`;
  const response = await axios.get(url, { headers: { "x-api-key": apiKey } });

  if (!response.data || !Array.isArray(response.data.messages)) {
    throw new Error("Fetched data does not contain a valid messages array");
  }
  const buffer = await generateExcelReport(response.data);
  return buffer;
};
