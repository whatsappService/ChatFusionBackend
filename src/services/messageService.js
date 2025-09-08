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
      const failed = resp.data?.data?.failedMessages || [];
      return {
        success: false,
        message: resp.data?.message,
        failedMessages: failed,
      };
    }
    return { success: true, message: resp.data?.message, failedMessages: [] };
  } catch (err) {
    return {
      success: false,
      message: err.message,
      failedMessages: [{ error: err.message }],
    };
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

  // helpers to keep logs safe & readable
  const maskPhone = (p = "") => {
    const s = String(p).replace(/\D/g, "");
    return s.length <= 4
      ? "****"
      : `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
  };
  const briefRecipients = (arr = [], sample = 5) => {
    const shown = arr.slice(0, sample).map(maskPhone);
    const rest = arr.length - shown.length;
    return rest > 0 ? `${shown.join(", ")} (+${rest} more)` : shown.join(", ");
  };
  const fileNames = (fs = []) => fs.map((f) => f?.originalname).filter(Boolean);

  // request summary
  console.log(
    `[send-bulk] → POST /send-bulk  recipients=${recipients.length}  messages=${
      (Array.isArray(messages) ? messages : [messages]).length
    }  files=${fileNames(files).length}`
  );
  if (process.env.DEBUG?.toLowerCase() === "true") {
    console.log(
      `[send-bulk] sample recipients: ${briefRecipients(recipients)}`
    );
    if (fileNames(files).length)
      console.log(`[send-bulk] files: ${fileNames(files).join(", ")}`);
  }

  try {
    const resp = await axios.post(
      "https://chatfusion.murraltd.com/api/messaging/send-bulk",
      form,
      { headers: { "x-api-key": apiKey, ...form.getHeaders() } }
    );

    // Log raw upstream result (compact)
    console.log(
      `[send-bulk] ← ${resp.status} ${resp.statusText}  success=${!!resp.data
        ?.success}  failedCount=${resp.data?.failedCount ?? 0}`
    );
    if (process.env.DEBUG?.toLowerCase() === "true") {
      // Safe deep log of response payload when DEBUG=true
      console.dir({ data: resp.data }, { depth: null, maxArrayLength: 50 });
    }

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
    // Axios error logging with plenty of context
    const status = err.response?.status;
    const statusText = err.response?.statusText;
    const data = err.response?.data;
    console.error(
      `[send-bulk] ✖ ERROR ${status ?? ""} ${statusText ?? ""} :: ${
        err.message
      }`
    );
    if (process.env.DEBUG?.toLowerCase() === "true") {
      console.error("[send-bulk] upstream error body:");
      console.dir(data, { depth: null, maxArrayLength: 200 });
    }

    return {
      success: false,
      message: err.message,
      failedMessages: recipients.map((r) => ({
        recipient: r,
        error:
          (Array.isArray(data?.failedMessages) &&
            data.failedMessages.find((f) => f?.recipient === r)?.error) ||
          data?.message ||
          err.message,
      })),
    };
  }
}

/** Send a single message with {name} & {business_name} substitution */
/**
 * Bulk API with smart path and automatic fallback:
 * - If no per-recipient placeholders (only globals like {business_name}), try one **bulk** call.
 * - If bulk fails (e.g., 404), FALL BACK to per-recipient sends automatically.
 * - If per-recipient placeholders exist, use personalized loop immediately.
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

  // Helper: personalized loop (used for both the personalized path and fallback)
  const sendPersonalized = async (data) => {
    const failed = [];
    for (const rd of data) {
      try {
        const phone = String(rd.recipient).replace(/\D/g, "");
        if (!/^\d+$/.test(phone)) throw new Error("Invalid phone format");

        // lookup customer for {name}
        let cust = await Customer.findOne({
          where: { whatsapp_number: phone },
        });
        if (!cust) {
          cust = await Customer.findOne({
            where: { whatsapp_number: { [Op.like]: `%${phone}` } },
          });
        }
        const customerName = cust?.profile_name || "";

        const map = {
          name: customerName,
          business_name: bizName,
          ...Object.entries(rd.variableOverrides || {}).reduce(
            (acc, [k, v]) => {
              acc[String(k).toLowerCase()] = v;
              return acc;
            },
            {}
          ),
        };

        const finalMsgs = [
          ...msgs.map((m) => placeholderReplacer(m, map)),
          ...(Array.isArray(rd.personalMessages)
            ? rd.personalMessages.map((m) => placeholderReplacer(m, map))
            : []),
        ];

        const r = await doSend(biz.api_key, phone, finalMsgs, globalFiles);
        if (!r.success) {
          // ✅ bugfix: use r.message/failedMessages instead of r.failed
          failed.push({
            recipient: phone,
            error: r.message || "send failed",
            details: r.failedMessages || [],
          });
        }
      } catch (err) {
        failed.push({ recipient: rd.recipient, error: err.message });
      }
    }

    return {
      success: failed.length === 0,
      message:
        failed.length === 0
          ? "All messages sent successfully"
          : `${failed.length} message(s) failed`,
      failedMessages: failed,
    };
  };

  // Try the single bulk call if safe to do so
  if (!anyPerRecipient) {
    const replaced = msgs.map((m) =>
      placeholderReplacer(m, { business_name: bizName })
    );
    const phones = recipientsData
      .map((r) => String(r.recipient || "").replace(/\D/g, ""))
      .filter((p) => /^\d+$/.test(p));

    // Optional env flag to disable bulk entirely (useful while diagnosing)
    const useBulk =
      (process.env.CHATFUSION_USE_BULK || "true").toLowerCase() !== "false";

    if (useBulk) {
      const bulk = await doSendBulk(biz.api_key, phones, replaced, globalFiles);
      if (bulk.success) {
        return {
          success: true,
          message: bulk.message || "Bulk sent",
          failedMessages: bulk.failedMessages || [],
        };
      }

      // 🔁 Fallback: if bulk API is missing/404 or otherwise fails, try personalized loop
      console.warn(
        "[send-bulk] bulk endpoint failed; falling back to per-recipient:",
        bulk.message
      );
      const fallbackData = phones.map((p) => ({ recipient: p }));
      return sendPersonalized(fallbackData);
    }

    // Bulk disabled → go straight to per-recipient
    const fallbackData = phones.map((p) => ({ recipient: p }));
    return sendPersonalized(fallbackData);
  }

  // Personalized path required (placeholders present)
  return sendPersonalized(recipientsData);
};

/**
 * Convenience: same message(s) for everyone (schedule use-case).
 * Tries true bulk first; **now falls back** automatically.
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
