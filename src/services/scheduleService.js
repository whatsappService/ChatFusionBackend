"use strict";

const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");

const ScheduledMessage = require("../models/scheduledMessage");
const Customer = require("../models/customer");
const MessageTemplate = require("../models/messageTemplate");

const { isValidIana, toLocalISO } = require("../utils/timezone");
const messageService = require("./messageService");

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "schedules");
const SERVER_TZ = process.env.SERVER_DEFAULT_TZ || "Asia/Hebron";

/* ---------------- cron-parser loader (CJS/ESM safe) ---------------- */
let _parseCronFn = null;
let _cronTried = false;

async function loadCronParser() {
  if (_cronTried) return _parseCronFn;
  _cronTried = true;

  try {
    // eslint-disable-next-line global-require
    const mod = require("cron-parser");
    if (mod && typeof mod.parseExpression === "function")
      _parseCronFn = mod.parseExpression;
    else if (mod?.default && typeof mod.default.parseExpression === "function")
      _parseCronFn = mod.default.parseExpression;
  } catch (_) {}

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
    const rel = p.replace(/^\/+/, "");
    const full = path.join(process.cwd(), rel);
    const name = path.basename(full);
    try {
      const buffer = await fs.readFile(full);
      list.push({ buffer, originalname: name });
    } catch {
      // ignore missing
    }
  }
  return list;
}

/* ---------------- helpers: templating ---------------- */
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

function pickTemplateBody(tpl) {
  if (!tpl) return null;
  return (
    tpl.body || tpl.content || tpl.message || tpl.text || tpl.text_body || null
  );
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

/* ---------------- audience resolver ---------------- */
function normalizePhones(list) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .map((s) => String(s || "").replace(/\D/g, ""))
        .filter((p) => p && /^\d+$/.test(p))
    )
  );
}

async function resolveRecipients(row) {
  // TO_NUMBER → prefer to_numbers_json; fallback to to_number
  if (row.audience_type === "TO_NUMBER") {
    const arr =
      Array.isArray(row.to_numbers_json) && row.to_numbers_json.length
        ? row.to_numbers_json
        : row.to_number
        ? [row.to_number]
        : [];
    return normalizePhones(arr);
  }

  if (row.audience_type === "CUSTOMERS") {
    const ids = Array.isArray(row.customer_ids_json)
      ? row.customer_ids_json
      : [];
    if (!ids.length) return [];
    const customers = await Customer.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["whatsapp_number"],
    });
    return normalizePhones(customers.map((c) => c.whatsapp_number));
  }

  if (row.audience_type === "CATEGORY") {
    const single = row.category_id ? [row.category_id] : [];
    const group = Array.isArray(row.category_ids_json)
      ? row.category_ids_json
      : [];
    const catIds = Array.from(new Set([...single, ...group].filter(Boolean)));
    if (!catIds.length) return [];
    const customers = await Customer.findAll({
      where: { category_id: { [Op.in]: catIds } },
      attributes: ["whatsapp_number"],
      limit: 10000,
    });
    return normalizePhones(customers.map((c) => c.whatsapp_number));
  }

  return [];
}

/* ---------------- core sender ---------------- */
async function deliverSchedule(row) {
  // Base text: template overrides body
  let baseText = row.body || "";
  if (row.template_id) {
    const tpl = await MessageTemplate.findByPk(row.template_id);
    const candidate = pickTemplateBody(tpl);
    if (candidate) baseText = candidate;
  }

  // Apply global variables_json once (e.g., {order_id}, etc.)
  const textAfterGlobals = applyVars(baseText, row.variables_json || null);
  const files = await loadSavedFiles(row.media_url);

  const recipients = await resolveRecipients(row);
  if (!recipients.length) {
    return { success: false, message: "No recipients resolved", recipients: 0 };
  }

  // Try bulk path (messageService will fallback if personalization is needed)
  const sendResult = await messageService.sendManySameMessage(
    row.business_id,
    recipients,
    [textAfterGlobals],
    files
  );

  const failedCount = Array.isArray(sendResult.failedMessages)
    ? sendResult.failedMessages.length
    : 0;

  // Normalize schedule send result shape
  return {
    success: failedCount === 0,
    recipients: recipients.length,
    failed: failedCount,
    results: sendResult.failedMessages || [],
  };
}

/* ---------------- create ---------------- */
exports.createSchedule = async (businessId, userId, body = {}, files = []) => {
  const {
    // audience
    audience_type = "TO_NUMBER",
    to_number = null,
    to_numbers_json = null, // NEW (array)
    customer_ids_json = null,
    category_id = null,
    category_ids_json = null, // NEW (array)
    template_id = null,

    // message
    body: msgBody = null,
    variables_json = null,

    // schedule
    type,
    send_at_utc = null,
    cron_expr = null,
    timezone = SERVER_TZ,
    status = "ACTIVE",
  } = body;

  if (!["ONE_OFF", "CRON"].includes(type)) throw new Error("Invalid type");
  if (type === "ONE_OFF" && !send_at_utc)
    throw new Error("send_at_utc is required for ONE_OFF");
  if (type === "CRON" && !cron_expr)
    throw new Error("cron_expr is required for CRON");

  // audience validation (support arrays)
  if (audience_type === "TO_NUMBER") {
    const arr = Array.isArray(to_numbers_json)
      ? to_numbers_json
      : (() => {
          try {
            const parsed =
              typeof to_numbers_json === "string"
                ? JSON.parse(to_numbers_json)
                : [];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();
    if (!(arr.length || to_number)) {
      throw new Error(
        "Provide to_number or to_numbers_json[] when audience_type=TO_NUMBER"
      );
    }
  }
  if (audience_type === "CUSTOMERS") {
    const arr = Array.isArray(customer_ids_json)
      ? customer_ids_json
      : (() => {
          try {
            const parsed =
              typeof customer_ids_json === "string"
                ? JSON.parse(customer_ids_json)
                : [];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();
    if (!arr.length) {
      throw new Error(
        "customer_ids_json (array) is required when audience_type=CUSTOMERS"
      );
    }
  }
  if (audience_type === "CATEGORY") {
    const arr = Array.isArray(category_ids_json)
      ? category_ids_json
      : (() => {
          try {
            const parsed =
              typeof category_ids_json === "string"
                ? JSON.parse(category_ids_json)
                : [];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();
    if (!(arr.length || category_id)) {
      throw new Error(
        "category_id or category_ids_json[] is required when audience_type=CATEGORY"
      );
    }
  }

  const media_url = await saveFiles(files);

  const payload = {
    id: uuidv4(),
    business_id: businessId,
    created_by_user: userId ?? null,

    // audience
    audience_type,
    to_number: to_number ? String(to_number).trim() : null,
    to_numbers_json:
      Array.isArray(to_numbers_json) || to_numbers_json == null
        ? to_numbers_json
        : (() => {
            try {
              const parsed =
                typeof to_numbers_json === "string"
                  ? JSON.parse(to_numbers_json)
                  : null;
              return parsed;
            } catch {
              return null;
            }
          })(),
    customer_ids_json:
      Array.isArray(customer_ids_json) || customer_ids_json == null
        ? customer_ids_json
        : (() => {
            try {
              const parsed =
                typeof customer_ids_json === "string"
                  ? JSON.parse(customer_ids_json)
                  : null;
              return parsed;
            } catch {
              return null;
            }
          })(),
    category_id: category_id ?? null,
    category_ids_json:
      Array.isArray(category_ids_json) || category_ids_json == null
        ? category_ids_json
        : (() => {
            try {
              const parsed =
                typeof category_ids_json === "string"
                  ? JSON.parse(category_ids_json)
                  : null;
              return parsed;
            } catch {
              return null;
            }
          })(),

    // message
    body: msgBody,
    media_url,
    variables_json: variables_json ?? null,

    // schedule
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

  // audience
  setIf("audience_type", body.audience_type);
  setIf("to_number", body.to_number?.trim?.() || body.to_number);

  // NEW: to_numbers_json
  setIf(
    "to_numbers_json",
    Array.isArray(body.to_numbers_json)
      ? body.to_numbers_json
      : typeof body.to_numbers_json === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(body.to_numbers_json);
            return Array.isArray(parsed) ? parsed : undefined;
          } catch {
            return undefined;
          }
        })()
      : body.to_numbers_json
  );

  setIf(
    "customer_ids_json",
    Array.isArray(body.customer_ids_json)
      ? body.customer_ids_json
      : typeof body.customer_ids_json === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(body.customer_ids_json);
            return Array.isArray(parsed) ? parsed : undefined;
          } catch {
            return undefined;
          }
        })()
      : body.customer_ids_json
  );

  setIf("category_id", body.category_id);

  // NEW: category_ids_json
  setIf(
    "category_ids_json",
    Array.isArray(body.category_ids_json)
      ? body.category_ids_json
      : typeof body.category_ids_json === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(body.category_ids_json);
            return Array.isArray(parsed) ? parsed : undefined;
          } catch {
            return undefined;
          }
        })()
      : body.category_ids_json
  );

  setIf("template_id", body.template_id);

  // content
  setIf("body", body.body);
  setIf("variables_json", body.variables_json ?? undefined);

  // schedule
  setIf("type", body.type);
  setIf(
    "send_at_utc",
    body.send_at_utc ? new Date(body.send_at_utc) : body.send_at_utc
  );
  setIf("cron_expr", body.cron_expr);
  setIf("timezone", isValidIana(body.timezone) ? body.timezone : undefined);
  setIf("status", body.status);

  // media
  const removeMedia =
    body.remove_media === 1 ||
    body.remove_media === "1" ||
    body.remove_media === true;

  if (removeMedia) {
    patch.media_url = null;
  }
  if (Array.isArray(files) && files.length) {
    patch.media_url = await saveFiles(files);
  }

  // recompute next_run_at based on effective values
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

  const sendResult = await deliverSchedule(row);

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
    patch.next_run_at = null;
  }

  await row.update(patch);
  return { ...row.toJSON(), sendResult };
};

/* ---------------- dispatcher: scan & send due ---------------- */
exports.dispatchDueSchedules = async (max = 25) => {
  const now = new Date();

  const where = {
    status: "ACTIVE",
    [Op.or]: [
      { next_run_at: { [Op.lte]: now } },
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
