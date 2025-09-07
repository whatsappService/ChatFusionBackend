"use strict";

const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const cronParser = require("cron-parser");
const ScheduledMessage = require("../models/scheduledMessage");
const { isValidIana, toLocalISO } = require("../utils/timezone");

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "schedules");

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function saveFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return null;
  await ensureDir();
  const urls = [];
  for (const f of files) {
    const ext = path.extname(f.originalname || "");
    const filename = `${uuidv4()}${ext || ""}`;
    const full = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(full, f.buffer);
    urls.push(`/uploads/schedules/${filename}`);
  }
  // store multiple as JSON string inside TEXT column
  return JSON.stringify(urls);
}

function computeNextRun({ type, cron_expr, timezone, send_at_utc, status }) {
  if (status !== "ACTIVE") return null;

  if (type === "ONE_OFF") {
    const when = send_at_utc ? new Date(send_at_utc) : null;
    return when && when > new Date() ? when : null;
  }

  if (type === "CRON" && cron_expr) {
    try {
      const it = cronParser.parseExpression(cron_expr, {
        tz: timezone || "Asia/Hebron",
      });
      return it.next().toDate();
    } catch {
      return null;
    }
  }
  return null;
}

exports.createSchedule = async (businessId, userId, body = {}, files = []) => {
  const {
    to_number,
    body: msgBody = null,
    type,
    send_at_utc = null,
    cron_expr = null,
    timezone = "Asia/Hebron",
    status = "ACTIVE",
    variables_json = null,
  } = body;

  if (!to_number) throw new Error("to_number is required");
  if (!["ONE_OFF", "CRON"].includes(type)) throw new Error("Invalid type");
  if (type === "ONE_OFF" && !send_at_utc)
    throw new Error("send_at_utc is required for ONE_OFF");
  if (type === "CRON" && !cron_expr)
    throw new Error("cron_expr is required for CRON");

  const media_url = await saveFiles(files);

  const payload = {
    id: uuidv4(),
    business_id: businessId,
    created_by_user: userId ?? null,
    to_number: String(to_number).trim(),
    body: msgBody,
    media_url,
    variables_json: variables_json ?? null,
    type,
    send_at_utc: send_at_utc ? new Date(send_at_utc) : null,
    cron_expr,
    timezone,
    status,
    last_run_at: null,
    next_run_at: null,
  };

  payload.next_run_at = computeNextRun(payload);

  const row = await ScheduledMessage.create(payload);
  return row.toJSON();
};

function withLocalFields(row, tz) {
  const js = row.toJSON ? row.toJSON() : row;
  if (!tz || !isValidIana(tz)) return js;
  return {
    ...js,
    next_run_local: js.next_run_at
      ? toLocalISO(new Date(js.next_run_at), tz)
      : null,
    last_run_local: js.last_run_at
      ? toLocalISO(new Date(js.last_run_at), tz)
      : null,
    send_at_local:
      js.type === "ONE_OFF" && js.send_at_utc
        ? toLocalISO(new Date(js.send_at_utc), tz)
        : null,
  };
}

exports.listSchedules = async (businessId, query = {}) => {
  const page = Number(query.page ?? 0);
  const limit = Math.min(200, Number(query.limit ?? 20));
  const q = (query.q || "").trim();
  const type = query.type || "";
  const status = query.status || "";
  const order = query.order || "updatedAt";
  const direction =
    (query.direction || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
  const tz =
    query.timezone && isValidIana(query.timezone) ? query.timezone : null;

  const where = { business_id: businessId };
  if (q) {
    where[Op.or] = [
      { to_number: { [Op.like]: `%${q}%` } },
      { body: { [Op.like]: `%${q}%` } },
    ];
  }
  if (type) where.type = type;
  if (status) where.status = status;

  const { rows, count } = await ScheduledMessage.findAndCountAll({
    where,
    limit,
    offset: page * limit,
    order: [[order, direction]],
  });

  const schedules = rows.map((r) => (tz ? withLocalFields(r, tz) : r.toJSON()));
  return { schedules, total: count, page, limit };
};

exports.getSchedule = async (businessId, id, tz) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  return tz && isValidIana(tz) ? withLocalFields(row, tz) : row.toJSON();
};

exports.updateSchedule = async (businessId, id, body = {}, files = []) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");

  const patch = {};
  const setIf = (k, v) => {
    if (v !== undefined) patch[k] = v;
  };

  setIf("to_number", body.to_number?.trim());
  setIf("body", body.body);
  setIf("variables_json", body.variables_json ?? undefined);
  setIf("type", body.type);
  setIf(
    "send_at_utc",
    body.send_at_utc ? new Date(body.send_at_utc) : body.send_at_utc
  );
  setIf("cron_expr", body.cron_expr);
  setIf("timezone", body.timezone);
  setIf("status", body.status);

  if (Array.isArray(files) && files.length) {
    patch.media_url = await saveFiles(files);
  }

  patch.next_run_at = computeNextRun({
    type: patch.type ?? row.type,
    cron_expr: patch.cron_expr ?? row.cron_expr,
    timezone: patch.timezone ?? row.timezone,
    send_at_utc: patch.send_at_utc ?? row.send_at_utc,
    status: patch.status ?? row.status,
  });

  await row.update(patch);
  return row.toJSON();
};

exports.setStatus = async (businessId, id, newStatus) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(newStatus)) {
    throw new Error("Invalid status");
  }
  const next_run_at = computeNextRun({
    type: row.type,
    cron_expr: row.cron_expr,
    timezone: row.timezone,
    send_at_utc: row.send_at_utc,
    status: newStatus,
  });
  await row.update({ status: newStatus, next_run_at });
  return row.toJSON();
};

exports.deleteSchedule = async (businessId, id) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  await row.destroy();
  return { message: "Schedule deleted successfully" };
};

exports.previewNextRuns = async (
  cron_expr,
  timezone = "Asia/Hebron",
  count = 5,
  from
) => {
  if (!cron_expr) throw new Error("cron_expr is required");
  const results = [];
  const opts = { tz: timezone };
  if (from) opts.currentDate = new Date(from);
  const it = cronParser.parseExpression(cron_expr, opts);
  const n = Math.max(1, Math.min(50, Number(count) || 5));
  for (let i = 0; i < n; i++) {
    results.push(it.next().toDate().toISOString());
  }
  return results;
};

exports.runNow = async (businessId, id) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");

  const now = new Date();
  const patch = { last_run_at: now };

  if (row.type === "CRON") {
    patch.next_run_at = computeNextRun({
      type: "CRON",
      cron_expr: row.cron_expr,
      timezone: row.timezone,
      status: row.status,
    });
  } else {
    patch.next_run_at = null; // one-off—no further runs
  }

  await row.update(patch);
  // enqueue actual send here if you have a worker/queue
  return row.toJSON();
};
