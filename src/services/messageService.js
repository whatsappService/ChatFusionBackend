// src/services/messageService.js
const axios = require("axios");
const FormData = require("form-data");
const { Op } = require("sequelize");
const Business = require("../models/business");
const Customer = require("../models/customer");
const { log } = require("winston");

/** Replace {key} in text using replacements[key.toLowerCase()] */
function placeholderReplacer(text, replacements) {
  return text.replace(/\{\s*(\w+)\s*\}/g, (_, key) => {
    const val = replacements[key.toLowerCase()];
    return val != null ? val : `{${key}}`;
  });
}

/** Low‑level send: recipient phone, array of messages, optional files[] */
async function doSend(apiKey, phone, messages, files = []) {
  console.log("⏩ [Service] doSend()", {
    phone,
    messages,
    filesCount: files.length,
  });

  const form = new FormData();
  form.append("recipient", phone);
  messages.forEach((msg) => form.append("contents", msg));
  files.forEach((file) =>
    form.append("files", file.buffer, { filename: file.originalname })
  );

  let resp;
  try {
    resp = await axios.post(
      "https://chatfusion.murraltd.com/api/messaging/send",
      form,
      { headers: { "x-api-key": apiKey, ...form.getHeaders() } }
    );
  } catch (err) {
    console.error("❌ [Service] doSend network/error:", err.message);
    return { success: false, failed: [{ error: err.message }] };
  }

  console.log("⬅️ [Service] ChatFusion response:", resp.data);
  if (!resp.data.success || resp.data.failedCount > 0) {
    return { success: false, failed: resp.data.data?.failedMessages || [] };
  }
  return { success: true, message: resp.data.message };
}

/** Send a single message with {name} & {business_name} substitution */
exports.sendSingleMessage = async (businessId, recipient, contents, files) => {
  console.log("=== [Service] sendSingleMessage START ===");
  console.log("businessId:", businessId, "recipient:", recipient);

  // 1) Load business
  const biz = await Business.findByPk(businessId);
  console.log("Loaded business:", biz?.id, biz?.name);
  if (!biz?.api_key) throw new Error("API key not found");
  const bizName = biz.name || biz.business_name || "";

  // 2) Normalize phone
  const phone = String(recipient).replace(/\D/g, "");
  console.log("Normalized phone:", phone);
  if (!/^\d+$/.test(phone)) throw new Error("Invalid phone format");

  // 3) Normalize messages
  const msgs = Array.isArray(contents) ? contents : [contents];
  console.log("Messages array:", msgs);

  // 4) Lookup customer name (exact → LIKE)
  let cust = await Customer.findOne({ where: { whatsapp_number: phone } });
  console.log("Exact lookup:", cust);
  if (!cust) {
    console.log("Exact lookup failed → trying LIKE");
    cust = await Customer.findOne({
      where: { whatsapp_number: { [Op.like]: `%${phone}` } },
    });
  }
  console.log("Final customer record:", cust);
  const customerName = cust?.profile_name || "";
  console.log("Resolved customerName:", customerName);

  // 5) Build placeholder map
  const map = { name: customerName, business_name: bizName };
  console.log("Placeholder map:", map);

  // 6) Replace placeholders
  const finalMsgs = msgs.map((m) => placeholderReplacer(m, map));
  console.log("Final messages to send:", finalMsgs);

  // 7) Send
  const result = await doSend(biz.api_key, phone, finalMsgs, files);
  console.log("sendSingleMessage result:", result);
  console.log("=== [Service] sendSingleMessage END ===\n");
  return result;
};

/** Send bulk messages with full logging */
exports.sendBulkMessage = async (
  businessId,
  globalMessages,
  recipientsData,
  globalFiles = []
) => {
  // log.info("=== [Service] sendBulkMessage START ===");
  console.log("=== [Service] sendBulkMessage START ===");
  console.log("businessId:", businessId);
  console.log("globalMessages:", globalMessages);
  console.log("recipientsData:", recipientsData);

  // 1) Load business
  const biz = await Business.findByPk(businessId);
  console.log("Loaded business:", biz?.id, biz?.name);
  if (!biz?.api_key) throw new Error("API key not found");
  const bizName = biz.name || biz.business_name || "";

  // 2) Validate inputs
  if (!Array.isArray(globalMessages))
    throw new Error("globalMessages must be an array");
  if (!Array.isArray(recipientsData))
    throw new Error("recipientsData must be an array");

  const failed = [];

  // 3) Iterate recipients
  for (const rd of recipientsData) {
    console.log("\n→ [Service] Processing recipient data:", rd);
    const { recipient, personalMessages = [], variableOverrides = {} } = rd;

    try {
      // a) Normalize phone
      const phone = String(recipient).replace(/\D/g, "");
      console.log("  phone:", phone);
      if (!/^\d+$/.test(phone)) throw new Error("Invalid phone format");

      // b) Lookup customer (exact → LIKE)
      let cust = await Customer.findOne({ where: { whatsapp_number: phone } });
      console.log("  exact lookup result:", cust);
      if (!cust) {
        console.log("  exact lookup failed → LIKE");
        cust = await Customer.findOne({
          where: { whatsapp_number: { [Op.like]: `%${phone}` } },
        });
      }
      console.log("  final customer record:", cust);
      const customerName = cust?.profile_name || "";
      console.log("  Resolved customerName:", customerName);

      // c) Build placeholder map (+ overrides)
      const map = {
        name: customerName,
        business_name: bizName,
        ...Object.entries(variableOverrides).reduce((acc, [k, v]) => {
          acc[k.toLowerCase()] = v;
          return acc;
        }, {}),
      };
      console.log("  Placeholder map:", map);

      // d) Replace placeholders in global + personal
      const finalMsgs = [
        ...globalMessages.map((m) => placeholderReplacer(m, map)),
        ...personalMessages.map((m) => placeholderReplacer(m, map)),
      ];
      console.log("  Final messages to send:", finalMsgs);

      // e) Send via doSend
      const sendResult = await doSend(
        biz.api_key,
        phone,
        finalMsgs,
        globalFiles
      );
      console.log("  doSend result:", sendResult);
      if (!sendResult.success) {
        failed.push({ recipient: phone, error: sendResult.failed });
      }
    } catch (err) {
      console.error("  Error processing recipient", recipient, err.message);
      failed.push({ recipient, error: err.message });
    }
  }

  // 4) Build summary
  const summary = {
    success: failed.length === 0,
    message:
      failed.length === 0
        ? "All bulk messages sent successfully"
        : `${failed.length} bulk message(s) failed`,
    failedMessages: failed,
  };
  console.log("=== [Service] sendBulkMessage END ===", summary, "\n");
  return summary;
};
