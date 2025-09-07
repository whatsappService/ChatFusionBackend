"use strict";

const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const ScheduledMessage = require("../models/scheduledMessage");
const { isValidIana, toLocalISO } = require("../utils/timezone");
const messageService = require("./messageService"); // ⬅️ use your sender

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "schedules");
const SERVER_TZ = process.env.SERVER_DEFAULT_TZ || "Asia/Hebron";

/* ---------------- cron-parser loader (CJS/ESM safe) ---------------- */
let _parseCronFn = null; // resolved function
let _cronTried = false; // ensure we try only once

async function loadCronParser() {
  if (_cronTried) return _parseCronFn;
  _cronTried = true;

  // Try CJS require first
  try {
    // eslint-disable-next-line global-require
    const mod = require("cron-parser");
    if (mod && typeof mod.parseExpression === "function")
      _parseCronFn = mod.parseExpression;
    else if (mod?.default && typeof mod.default.parseExpression === "function")
      _parseCronFn = mod.default.parseExpression;
  } catch (_) {}

  // Fallback: dynamic import (ESM)
  if (!_parseCronFn) {
    try {
      const mod = await import("cron-parser");
      if (mod && typeof mod.parseExpression === "function")
        _parseCronFn = mod.parseExpression;
      else if (
        mod?.default &&
        typeof mod.default.parseExpression === "function"
      )
        _parseCronFn = mod.default.parseExpression;
    } catch (_) {}
  }

  return _parseCronFn;
}

/* ---------------- helpers: files ---------------- */
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
    await fs.writeFile(path.join(UPLOAD_DIR, filename), f.buffer);
    urls.push(`/uploads/schedules/${filename}`);
  }
  return JSON.stringify(urls);
}

/** Load previously saved files back to buffers for sending */
async function loadSavedFiles(media_url) {
  const list = [];
  if (!media_url) return list;

  let arr;
  try {
    arr = JSON.parse(media_url);
  } catch {
    return list;
  }
  if (!Array.isArray(arr) || !arr.length) return list;

  for (const p of arr) {
    if (!p || typeof p !== "string") continue;
    // stored like "/uploads/schedules/<name>"
    const rel = p.replace(/^\/+/, ""); // strip leading slash
    const full = path.join(process.cwd(), rel);
    const name = path.basename(full);
    try {
      const buffer = await fs.readFile(full);
      list.push({ buffer, originalname: name });
    } catch {
      // ignore missing files
    }
  }
  return list;
}

/* ---------------- helpers: text templating ---------------- */
/** Replace {key} in text from a plain object of variables (case-insensitive) */
function applyVars(text, vars) {
  if (!text || !vars || typeof vars !== "object") return text || "";
  const dict = Object.keys(vars).reduce((acc, k) => {
    acc[String(k).toLowerCase()] = vars[k];
    return acc;
  }, {});
  return String(text).replace(/\{\s*([\w.]+)\s*\}/g, (_, rawKey) => {
    const key = String(rawKey).toLowerCase();
    return dict[key] != null ? String(dict[key]) : `{${rawKey}}`;
  });
}

/* ---------------- helpers: schedule logic ---------------- */
async function computeNextRunAsync({
  type,
  cron_expr,
  timezone,
  send_at_utc,
  status,
}) {
  if (status !== "ACTIVE") return null;

  if (type === "ONE_OFF") {
    const when = send_at_utc ? new Date(send_at_utc) : null;
    return when && when > new Date() ? when : null;
  }

  if (type === "CRON" && cron_expr) {
    const parseCron = await loadCronParser();
    if (!parseCron) return null;
    try {
      const it = parseCron(cron_expr, {
        tz: isValidIana(timezone) ? timezone : SERVER_TZ,
      });
      return it.next().toDate();
    } catch {
      return null;
    }
  }
  return null;
}

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

/* ---------------- core sender for a single schedule ---------------- */
/**
 * Sends the message of a schedule row.
 * - Uses variables_json for {placeholders} first
 * - Lets messageService also substitute {name} and {business_name}
 * - Reattaches any local media files saved during creation
 */
async function sendScheduleMessage(row) {
  const files = await loadSavedFiles(row.media_url);
  const body = applyVars(row.body || "", row.variables_json || null);
  const contents = [body];

  // messageService handles business lookup + {name}/{business_name} internally
  return messageService.sendSingleMessage(
    row.business_id,
    row.to_number,
    contents,
    files
  );
}

/* ---------------- create ---------------- */
exports.createSchedule = async (businessId, userId, body = {}, files = []) => {
  const {
    to_number,
    body: msgBody = null,
    type,
    send_at_utc = null,
    cron_expr = null,
    timezone = SERVER_TZ,
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
    timezone: isValidIana(timezone) ? timezone : SERVER_TZ,
    status,
    last_run_at: null,
    next_run_at: null,
  };

  payload.next_run_at = await computeNextRunAsync(payload);

  const row = await ScheduledMessage.create(payload);
  return row.toJSON();
};

/* ---------------- list ---------------- */
exports.listSchedules = async (businessId, query = {}) => {
  const page = Math.max(0, Number(query.page ?? 0));
  const limit = Math.min(200, Math.max(1, Number(query.limit ?? 20)));
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
  return { schedules, total: count, page, limit, timezone: tz || undefined };
};

/* ---------------- get ---------------- */
exports.getSchedule = async (businessId, id, tz) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  return tz && isValidIana(tz) ? withLocalFields(row, tz) : row.toJSON();
};

/* ---------------- update ---------------- */
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
  setIf("timezone", isValidIana(body.timezone) ? body.timezone : undefined);
  setIf("status", body.status);

  if (Array.isArray(files) && files.length) {
    patch.media_url = await saveFiles(files);
  }

  const eff = {
    type: patch.type ?? row.type,
    cron_expr: patch.cron_expr ?? row.cron_expr,
    timezone: patch.timezone ?? row.timezone,
    send_at_utc: patch.send_at_utc ?? row.send_at_utc,
    status: patch.status ?? row.status,
  };
  patch.next_run_at = await computeNextRunAsync(eff);

  await row.update(patch);
  return row.toJSON();
};

/* ---------------- status ---------------- */
exports.setStatus = async (businessId, id, newStatus) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(newStatus)) {
    throw new Error("Invalid status");
  }
  const next_run_at = await computeNextRunAsync({
    type: row.type,
    cron_expr: row.cron_expr,
    timezone: row.timezone,
    send_at_utc: row.send_at_utc,
    status: newStatus,
  });
  await row.update({ status: newStatus, next_run_at });
  return row.toJSON();
};

/* ---------------- delete ---------------- */
exports.deleteSchedule = async (businessId, id) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  await row.destroy();
  return { message: "Schedule deleted successfully" };
};

/* ---------------- preview cron ---------------- */
exports.previewNextRuns = async (
  cron_expr,
  timezone = SERVER_TZ,
  count = 5,
  from
) => {
  if (!cron_expr) throw new Error("cron_expr is required");

  const parseCron = await loadCronParser();
  if (!parseCron) {
    const err = new Error(
      "CRON preview unavailable: cron-parser not found. Install it or pin a compatible version."
    );
    err.status = 500;
    throw err;
  }

  const results = [];
  const opts = { tz: isValidIana(timezone) ? timezone : SERVER_TZ };
  if (from) opts.currentDate = new Date(from);

  let it;
  try {
    it = parseCron(cron_expr, opts);
  } catch (_) {
    const err = new Error("Invalid CRON expression");
    err.status = 400;
    throw err;
  }

  const n = Math.max(1, Math.min(50, Number(count) || 5));
  for (let i = 0; i < n; i++) {
    results.push(it.next().toDate().toISOString());
  }
  return results;
};

/* ---------------- run now (send + advance) ---------------- */
exports.runNow = async (businessId, id) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  if (row.status !== "ACTIVE") return row.toJSON();

  // 1) Send
  const result = await sendScheduleMessage(row);

  // 2) Advance pointers regardless of send success (you can change policy)
  const now = new Date();
  const patch = { last_run_at: now };

  if (row.type === "CRON") {
    patch.next_run_at = await computeNextRunAsync({
      type: "CRON",
      cron_expr: row.cron_expr,
      timezone: row.timezone,
      status: row.status,
    });
  } else {
    patch.next_run_at = null; // one-off—no further runs
    // Optionally auto-cancel after run:
    // patch.status = "CANCELLED";
  }

  await row.update(patch);
  return { ...row.toJSON(), sendResult: result };
};

/* ---------------- dispatcher: scan & send due ---------------- */
/**
 * Process due schedules.
 * - CRON: next_run_at <= now
 * - ONE_OFF: (next_run_at <= now) OR (next_run_at IS NULL AND send_at_utc <= now AND last_run_at IS NULL)
 * Note: This is a simple, single-process loop. For multi-process safety,
 * add row-level locks/claims (e.g. a `locked_until` column) or run one worker.
 */
exports.dispatchDueSchedules = async (max = 25) => {
  const now = new Date();

  const where = {
    status: "ACTIVE",
    [Op.or]: [
      // any due by next_run_at
      { next_run_at: { [Op.lte]: now } },
      // safety for one-offs created in the past without next_run_at set
      {
        [Op.and]: [
          { type: "ONE_OFF" },
          { next_run_at: { [Op.is]: null } },
          { last_run_at: { [Op.is]: null } },
          { send_at_utc: { [Op.lte]: now } },
        ],
      },
    ],
  };

  const rows = await ScheduledMessage.findAll({
    where,
    order: [["next_run_at", "ASC"]],
    limit: Math.max(1, Math.min(200, Number(max) || 25)),
  });

  const results = [];
  for (const row of rows) {
    try {
      const r = await exports.runNow(row.business_id, row.id);
      results.push({ id: row.id, ok: true, result: r.sendResult || null });
    } catch (e) {
      results.push({ id: row.id, ok: false, error: e.message });
    }
  }
  return { processed: results.length, results };
};
