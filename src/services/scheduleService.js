"use strict";

const { Op } = require("sequelize");
const axios = require("axios");
const parser = require("cron-parser"); // npm i cron-parser
const { v4: uuidv4 } = require("uuid"); // npm i uuid
const path = require("path");
const url = require("url");

const { ScheduledMessage } = require("../models/associations");
const messageService = require("./messageService");

/** Replace {key} in text using vars[key.toLowerCase()] */
function replacePlaceholders(text, vars = {}) {
  if (!text) return text;
  return text.replace(/\{\s*(\w+)\s*\}/g, (_, k) => {
    const v = vars[k.toLowerCase()];
    return v != null ? String(v) : `{${k}}`;
  });
}

function computeNextRun(cronExpr, tz, fromDate = new Date()) {
  if (!cronExpr) return null;
  try {
    const it = parser.parseExpression(cronExpr, { tz, currentDate: fromDate });
    return it.next().toDate();
  } catch {
    return null;
  }
}

function pick(obj, keys) {
  return Object.fromEntries(
    keys.filter((k) => k in obj).map((k) => [k, obj[k]])
  );
}

/** Attempt to download media_url → returns [{ buffer, originalname, mimetype }] or [] */
async function fetchMediaAsFiles(mediaUrl) {
  if (!mediaUrl) return [];
  try {
    const resp = await axios.get(mediaUrl, { responseType: "arraybuffer" });
    const parsed = url.parse(mediaUrl);
    const filename = path.basename(parsed.pathname || "attachment");
    const contentType =
      resp.headers["content-type"] || "application/octet-stream";
    return [
      {
        buffer: Buffer.from(resp.data),
        originalname: filename,
        mimetype: contentType,
      },
    ];
  } catch {
    // If media download fails, just send text
    return [];
  }
}

exports.createSchedule = async (business_id, created_by_user, body) => {
  const data = pick(body, [
    "to_number",
    "text", // allow 'text' alias for body
    "body",
    "media_url",
    "variables_json", // object map
    "type", // "ONE_OFF" | "CRON"
    "send_at_utc",
    "cron_expr",
    "timezone",
  ]);

  const type = (data.type || "ONE_OFF").toUpperCase();
  if (!["ONE_OFF", "CRON"].includes(type)) {
    const e = new Error("type must be ONE_OFF or CRON");
    e.status = 400;
    throw e;
  }

  const to_number = data.to_number || body.recipient; // accept 'recipient' alias
  if (!to_number) {
    const e = new Error("to_number (recipient) is required");
    e.status = 400;
    throw e;
  }

  const timezone = data.timezone || "Asia/Hebron";
  const textBody = data.body ?? data.text ?? "";

  const sendAt =
    type === "ONE_OFF"
      ? data.send_at_utc
        ? new Date(data.send_at_utc)
        : null
      : null;

  const nextRun =
    type === "CRON" ? computeNextRun(data.cron_expr, timezone) : sendAt;

  const row = await ScheduledMessage.create({
    id: uuidv4(),
    business_id,
    created_by_user: created_by_user || null,
    to_number,
    body: textBody,
    media_url: data.media_url || null,
    variables_json:
      typeof data.variables_json === "object" ? data.variables_json : null,
    type,
    send_at_utc: sendAt,
    cron_expr: type === "CRON" ? data.cron_expr : null,
    timezone,
    status: "ACTIVE",
    last_run_at: null,
    next_run_at: nextRun,
    max_attempts: 3,
  });

  return row;
};

exports.listSchedules = async (business_id, q = {}) => {
  const page = Math.max(0, Number(q.page || 0));
  const limit = Math.min(Math.max(1, Number(q.limit || 20)), 100);

  const where = { business_id };

  if (q.type) where.type = q.type.toUpperCase(); // ONE_OFF|CRON
  if (q.status) where.status = q.status.toUpperCase(); // ACTIVE|PAUSED|CANCELLED

  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt[Op.gte] = new Date(q.from);
    if (q.to) where.createdAt[Op.lte] = new Date(q.to);
  }

  const { rows, count } = await ScheduledMessage.findAndCountAll({
    where,
    offset: page * limit,
    limit,
    order: [["createdAt", "DESC"]],
  });

  return { items: rows, total: count, page, limit };
};

exports.getSchedule = async (business_id, id) => {
  const row = await ScheduledMessage.findOne({ where: { id, business_id } });
  if (!row) {
    const e = new Error("Schedule not found");
    e.status = 404;
    throw e;
  }
  return row;
};

exports.updateSchedule = async (business_id, id, patch) => {
  const row = await this.getSchedule(business_id, id);

  const data = pick(patch, [
    "to_number",
    "body",
    "text", // alias to update body
    "media_url",
    "variables_json",
    "type",
    "send_at_utc",
    "cron_expr",
    "timezone",
    "status",
    "max_attempts",
  ]);

  if ("to_number" in data) row.to_number = data.to_number;
  if ("body" in data || "text" in data)
    row.body = data.body ?? data.text ?? row.body;
  if ("media_url" in data) row.media_url = data.media_url;
  if ("variables_json" in data && typeof data.variables_json === "object")
    row.variables_json = data.variables_json;
  if ("max_attempts" in data)
    row.max_attempts = Number(data.max_attempts) || row.max_attempts;

  if ("type" in data) {
    const t = (data.type || "").toUpperCase();
    if (!["ONE_OFF", "CRON"].includes(t)) {
      const e = new Error("type must be ONE_OFF or CRON");
      e.status = 400;
      throw e;
    }
    row.type = t;
  }

  if ("status" in data) {
    const s = (data.status || "").toUpperCase();
    if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(s)) {
      const e = new Error("status must be ACTIVE, PAUSED, or CANCELLED");
      e.status = 400;
      throw e;
    }
    row.status = s;
  }

  if ("send_at_utc" in data)
    row.send_at_utc = data.send_at_utc ? new Date(data.send_at_utc) : null;
  if ("cron_expr" in data) row.cron_expr = data.cron_expr || null;
  if ("timezone" in data) row.timezone = data.timezone || row.timezone;

  // recompute next_run_at
  row.next_run_at =
    row.type === "CRON"
      ? computeNextRun(row.cron_expr, row.timezone)
      : row.send_at_utc || null;

  await row.save();
  return row;
};

exports.setStatus = async (business_id, id, status) => {
  const row = await this.getSchedule(business_id, id);
  const s = (status || "").toUpperCase();
  if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(s)) {
    const e = new Error("status must be ACTIVE, PAUSED, or CANCELLED");
    e.status = 400;
    throw e;
  }
  row.status = s;
  await row.save();
  return { ok: true, id: row.id, status: row.status };
};

exports.deleteSchedule = async (business_id, id) => {
  const row = await this.getSchedule(business_id, id);
  await row.destroy();
  return { ok: true };
};

exports.previewNextRuns = async (
  cron_expr,
  timezone = "Asia/Hebron",
  count = 5,
  from
) => {
  if (!cron_expr) {
    const e = new Error("cron_expr is required");
    e.status = 400;
    throw e;
  }
  const currentDate = from ? new Date(from) : new Date();
  const out = [];
  const it = parser.parseExpression(cron_expr, { tz: timezone, currentDate });
  for (let i = 0; i < Number(count || 5); i++) out.push(it.next().toDate());
  return out;
};

/** Run the schedule immediately (text + optional media_url) */
exports.runNow = async (business_id, id) => {
  const row = await this.getSchedule(business_id, id);
  if (row.status !== "ACTIVE") {
    return { ok: false, message: "Schedule is not ACTIVE" };
  }

  const vars = row.variables_json || {};
  const text = replacePlaceholders(row.body || "", vars);
  const files = await fetchMediaAsFiles(row.media_url);

  // ✅ Enforce/record usage by passing userId + default period ("month")
  const result = await messageService.sendSingleMessage(
    business_id,
    row.to_number,
    [text].filter(Boolean),
    files,
    { userId: row.created_by_user || null, period: "month" }
  );

  row.last_run_at = new Date();
  await row.save();

  // If sending failed (including quota block), surface ok=false
  return { ok: !!result.success, result };
};
