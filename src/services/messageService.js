"use strict";

const axios = require("axios");
const FormData = require("form-data");
const { Op } = require("sequelize");
const Business = require("../models/business");
const Customer = require("../models/customer");

/** Replace {key} in text using replacements[key.toLowerCase()] */
function placeholderReplacer(text, replacements) {
  return String(text || "").replace(/\{\s*(\w+)\s*\}/g, (_, key) => {
    const val = replacements[String(key).toLowerCase()];
    return val != null ? val : `{${key}}`;
  });
}

/** Detect placeholders that require per-recipient substitution (e.g., {name}) */
function needsPerRecipient(text) {
  const tokens = new Set();
  String(text || "").replace(/\{\s*(\w+)\s*\}/g, (_, key) =>
    tokens.add(String(key).toLowerCase())
  );
  // `business_name` is global, everything else implies per-recipient/override
  tokens.delete("business_name");
  return tokens.size > 0;
}

/** Low-level single-recipient send: recipient phone, array of messages, optional files[] */
async function doSend(apiKey, phone, messages, files = []) {
  const form = new FormData();
  form.append("recipient", phone);
  (Array.isArray(messages) ? messages : [messages]).forEach((msg) =>
    form.append("contents", msg)
  );
  (Array.isArray(files) ? files : []).forEach((file) =>
    form.append("files", file.buffer, { filename: file.originalname })
  );

  try {
    const resp = await axios.post(
      "https://chatfusion.murraltd.com/api/messaging/send",
      form,
      { headers: { "x-api-key": apiKey, ...form.getHeaders() } }
    );
    if (!resp.data?.success || resp.data?.failedCount > 0) {
      return { success: false, failed: resp.data?.data?.failedMessages || [] };
    }
    return { success: true, message: resp.data?.message };
  } catch (err) {
    return { success: false, failed: [{ error: err.message }] };
  }
}

/**
 * Low-level bulk send to a single API call with many recipients.
 * Expects the upstream API to accept:
 *  - form field "recipients" as JSON array of phones
 *  - repeated "contents"
 *  - "files" attachments
 * Falls back to per-recipient doSend on transport error if instructed by caller.
 */
async function doSendBulk(apiKey, recipients, messages, files = []) {
  const form = new FormData();
  form.append("recipients", JSON.stringify(recipients));
  (Array.isArray(messages) ? messages : [messages]).forEach((msg) =>
    form.append("contents", msg)
  );
  (Array.isArray(files) ? files : []).forEach((file) =>
    form.append("files", file.buffer, { filename: file.originalname })
  );

  try {
    const resp = await axios.post(
      "https://chatfusion.murraltd.com/api/messaging/send-bulk",
      form,
      { headers: { "x-api-key": apiKey, ...form.getHeaders() } }
    );

    // Normalize to a common shape
    const ok = !!resp.data?.success && !(resp.data?.failedCount > 0);
    const failed =
      resp.data?.data?.failedMessages ||
      resp.data?.failedMessages ||
      resp.data?.failed ||
      [];

    return {
      success: ok,
      message: resp.data?.message || (ok ? "Bulk sent" : "Bulk partial/failed"),
      failedMessages: Array.isArray(failed) ? failed : [],
    };
  } catch (err) {
    return {
      success: false,
      message: err.message,
      failedMessages: recipients.map((r) => ({
        recipient: r,
        error: err.message,
      })),
    };
  }
}

/** Send a single message with {name} & {business_name} substitution */
exports.sendSingleMessage = async (businessId, recipient, contents, files) => {
  const biz = await Business.findByPk(businessId);
  if (!biz?.api_key) throw new Error("API key not found");
  const bizName = biz.name || biz.business_name || "";

  const phone = String(recipient).replace(/\D/g, "");
  if (!/^\d+$/.test(phone)) throw new Error("Invalid phone format");

  const msgs = Array.isArray(contents) ? contents : [contents];

  // Get a customer to fill {name}
  let cust = await Customer.findOne({ where: { whatsapp_number: phone } });
  if (!cust) {
    cust = await Customer.findOne({
      where: { whatsapp_number: { [Op.like]: `%${phone}` } },
    });
  }
  const customerName = cust?.profile_name || "";

  const map = { name: customerName, business_name: bizName };
  const finalMsgs = msgs.map((m) => placeholderReplacer(m, map));

  return doSend(biz.api_key, phone, finalMsgs, files);
};

/**
 * Bulk API with smart path:
 * - If NO per-recipient placeholders are present (only {business_name} / globals),
 *   use one **bulk** API call (doSendBulk).
 * - Otherwise, fall back to per-recipient sends with personalized replacements.
 *
 * @param {number|string} businessId
 * @param {string[]} globalMessages - array of message strings
 * @param {{recipient:string, personalMessages?:string[], variableOverrides?:Record<string,string>}[]} recipientsData
 * @param {Array<{buffer:Buffer, originalname:string}>} globalFiles
 */
exports.sendBulkMessage = async (
  businessId,
  globalMessages,
  recipientsData,
  globalFiles = []
) => {
  const biz = await Business.findByPk(businessId);
  if (!biz?.api_key) throw new Error("API key not found");
  const bizName = biz.name || biz.business_name || "";

  const msgs = Array.isArray(globalMessages)
    ? globalMessages
    : [globalMessages];

  const anyPerRecipient =
    recipientsData.some(
      (r) =>
        (r.personalMessages && r.personalMessages.length) ||
        (r.variableOverrides && Object.keys(r.variableOverrides).length)
    ) || msgs.some((m) => needsPerRecipient(m));

  if (!anyPerRecipient) {
    // Only globals → replace business_name once and hit bulk endpoint.
    const replaced = msgs.map((m) =>
      placeholderReplacer(m, { business_name: bizName })
    );
    const phones = recipientsData
      .map((r) => String(r.recipient || "").replace(/\D/g, ""))
      .filter((p) => /^\d+$/.test(p));

    const bulk = await doSendBulk(biz.api_key, phones, replaced, globalFiles);

    // Normalize result
    return {
      success: bulk.success,
      message: bulk.message,
      failedMessages: bulk.failedMessages || [],
    };
  }

  // Personalized path
  const failed = [];
  for (const rd of recipientsData) {
    try {
      const phone = String(rd.recipient).replace(/\D/g, "");
      if (!/^\d+$/.test(phone)) throw new Error("Invalid phone format");

      // lookup customer for {name}
      let cust = await Customer.findOne({ where: { whatsapp_number: phone } });
      if (!cust) {
        cust = await Customer.findOne({
          where: { whatsapp_number: { [Op.like]: `%${phone}` } },
        });
      }
      const customerName = cust?.profile_name || "";

      const map = {
        name: customerName,
        business_name: bizName,
        ...Object.entries(rd.variableOverrides || {}).reduce((acc, [k, v]) => {
          acc[String(k).toLowerCase()] = v;
          return acc;
        }, {}),
      };

      const finalMsgs = [
        ...msgs.map((m) => placeholderReplacer(m, map)),
        ...(Array.isArray(rd.personalMessages)
          ? rd.personalMessages.map((m) => placeholderReplacer(m, map))
          : []),
      ];

      const r = await doSend(biz.api_key, phone, finalMsgs, globalFiles);
      if (!r.success) failed.push({ recipient: phone, error: r.failed });
    } catch (err) {
      failed.push({ recipient: rd.recipient, error: err.message });
    }
  }

  return {
    success: failed.length === 0,
    message:
      failed.length === 0
        ? "All bulk messages sent successfully"
        : `${failed.length} bulk message(s) failed`,
    failedMessages: failed,
  };
};

/**
 * Convenience: same message(s) for everyone (schedule use-case).
 * Tries true bulk first; falls back automatically.
 */
exports.sendManySameMessage = async (
  businessId,
  recipients /* string[] */,
  messages /* string[] */,
  files = []
) => {
  const data = recipients.map((r) => ({ recipient: r }));
  return exports.sendBulkMessage(businessId, messages, data, files);
};
