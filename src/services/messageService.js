// src/services/messageService.js
"use strict";

const axios = require("axios");
const FormData = require("form-data");
const { Op } = require("sequelize");
const { Business, Customer } = require("../models/associations");

/** Replace {key} in text using replacements[key.toLowerCase()] */
function placeholderReplacer(text, replacements) {
  return String(text || "").replace(/\{\s*(\w+)\s*\}/g, (_, key) => {
    const val = replacements[key.toLowerCase()];
    return val != null ? val : `{${key}}`;
  });
}

async function doSend(apiKey, phone, messages, files = []) {
  const form = new FormData();
  form.append("recipient", phone);
  messages.forEach((msg) => form.append("contents", msg));
  files.forEach((file) =>
    form.append("files", file.buffer, { filename: file.originalname })
  );

  try {
    const resp = await axios.post(
      "https://chatfusion.murraltd.com/api/messaging/send",
      form,
      { headers: { "x-api-key": apiKey, ...form.getHeaders() } }
    );
    if (!resp.data.success || resp.data.failedCount > 0) {
      return { success: false, failed: resp.data.data?.failedMessages || [] };
    }
    return { success: true, message: resp.data.message };
  } catch (err) {
    return { success: false, failed: [{ error: err.message }] };
  }
}

exports.sendSingleMessage = async (businessId, recipient, contents, files) => {
  const biz = await Business.findByPk(businessId);
  if (!biz?.api_key) throw new Error("API key not found");

  const phone = String(recipient).replace(/\D/g, "");
  if (!/^\d+$/.test(phone)) throw new Error("Invalid phone format");

  const msgs = Array.isArray(contents) ? contents : [contents];
  let cust = await Customer.findOne({ where: { whatsapp_number: phone } });
  if (!cust) {
    cust = await Customer.findOne({
      where: { whatsapp_number: { [Op.like]: `%${phone}` } },
    });
  }
  const map = {
    name: cust?.profile_name || "",
    business_name: biz.name || biz.business_name || "",
  };
  const finalMsgs = msgs.map((m) => placeholderReplacer(m, map));
  return doSend(biz.api_key, phone, finalMsgs, files);
};

exports.sendBulkMessage = async (
  businessId,
  globalMessages,
  recipientsData,
  globalFiles = []
) => {
  const biz = await Business.findByPk(businessId);
  if (!biz?.api_key) throw new Error("API key not found");

  if (!Array.isArray(globalMessages))
    throw new Error("globalMessages must be an array");
  if (!Array.isArray(recipientsData))
    throw new Error("recipientsData must be an array");

  const failed = [];
  for (const rd of recipientsData) {
    const { recipient, personalMessages = [], variableOverrides = {} } = rd;
    try {
      const phone = String(recipient).replace(/\D/g, "");
      if (!/^\d+$/.test(phone)) throw new Error("Invalid phone format");

      let cust = await Customer.findOne({ where: { whatsapp_number: phone } });
      if (!cust) {
        cust = await Customer.findOne({
          where: { whatsapp_number: { [Op.like]: `%${phone}` } },
        });
      }
      const map = Object.fromEntries(
        Object.entries(variableOverrides || {}).map(([k, v]) => [
          String(k).toLowerCase(),
          v,
        ])
      );
      map.name = cust?.profile_name || "";
      map.business_name = biz.name || biz.business_name || "";

      const finalMsgs = [
        ...globalMessages.map((m) => placeholderReplacer(m, map)),
        ...personalMessages.map((m) => placeholderReplacer(m, map)),
      ];
      const sendResult = await doSend(
        biz.api_key,
        phone,
        finalMsgs,
        globalFiles
      );
      if (!sendResult.success)
        failed.push({ recipient: phone, error: sendResult.failed });
    } catch (err) {
      failed.push({ recipient, error: err.message });
    }
  }

  return {
    success: failed.length === 0,
    message: failed.length
      ? `${failed.length} bulk message(s) failed`
      : "All bulk messages sent successfully",
    failedMessages: failed,
  };
};
