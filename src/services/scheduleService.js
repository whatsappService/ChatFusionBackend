// services/scheduleService.js
"use strict";

const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");

// IMPORTANT: match your actual filename/casing
const ScheduledMessage = require("../models/ScheduledMessage");
const ScheduledMessageItem = require("../models/ScheduledMessageItem");
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

/* ---------------- file helpers ---------------- */
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

/** turn legacy/media_json+media_url into local files+remote urls for send */
async function extractMediaSources(media_url, media_json) {
  const files = [];
  const urls = [];

  const pushLocalFile = async (p) => {
    if (!p || typeof p !== "string") return;
    if (!p.startsWith("/uploads/")) return;
    const rel = p.replace(/^\/+/, "");
    const full = path.join(process.cwd(), rel);
    const name = path.basename(full);
    try {
      const buffer = await fs.readFile(full);
      files.push({ buffer, originalname: name });
    } catch {
      // silent
    }
  };

  const pushUrlOrLocal = async (u) => {
    if (!u || typeof u !== "string") return;
    if (u.startsWith("/uploads/")) await pushLocalFile(u);
    else urls.push(u);
  };

  if (Array.isArray(media_json)) {
    for (const m of media_json) {
      const u = m?.url || m?.href || m?.src;
      if (typeof u === "string") await pushUrlOrLocal(u);
    }
  }

  if (media_url) {
    let arr = null;
    if (typeof media_url === "string") {
      try {
        const parsed = JSON.parse(media_url);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {
        arr = [media_url];
      }
    } else if (Array.isArray(media_url)) {
      arr = media_url;
    }
    if (Array.isArray(arr)) {
      for (const u of arr) await pushUrlOrLocal(u);
    }
  }

  return { files, urls };
}
async function mergeMediaSources(
  item_media_url,
  item_media_json,
  row_media_url,
  row_media_json
) {
  const a = await extractMediaSources(item_media_url, item_media_json);
  const b = await extractMediaSources(row_media_url, row_media_json);
  return { files: [...a.files, ...b.files], urls: [...a.urls, ...b.urls] };
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
async function computeNextCron({ cron_expr, timezone }, from = new Date()) {
  const parseCron = await loadCronParser();
  if (!parseCron) return null;
  try {
    const it = parseCron(cron_expr, {
      tz: isValidIana(timezone) ? timezone : SERVER_TZ,
      currentDate: from,
    });
    return it.next().toDate();
  } catch {
    return null;
  }
}
async function computePrevCron({ cron_expr, timezone }, from = new Date()) {
  const parseCron = await loadCronParser();
  if (!parseCron) return null;
  try {
    const it = parseCron(cron_expr, {
      tz: isValidIana(timezone) ? timezone : SERVER_TZ,
      currentDate: from,
    });
    return it.prev().toDate();
  } catch {
    return null;
  }
}
async function computeInitialNextRun(payload, items = [], now = new Date()) {
  if (payload.status !== "ACTIVE") return null;

  if (payload.type === "ONE_OFF") {
    if (!payload.send_at_utc) return null;
    const base = new Date(payload.send_at_utc);
    if (isNaN(base)) return null;

    const enabledItems = (items || []).filter((it) => it.enabled !== false);
    const offsets = enabledItems.length
      ? enabledItems.map((i) => Number(i.offset_seconds) || 0)
      : [0];
    const times = offsets
      .map((off) => new Date(base.getTime() + off * 1000))
      .filter((d) => d >= now);
    return times.length
      ? new Date(Math.min(...times.map((d) => d.getTime())))
      : null;
  }

  if (payload.type === "CRON" && payload.cron_expr) {
    return await computeNextCron(payload, now);
  }

  return null;
}
async function computePostRunNextRun(row, items, now = new Date()) {
  if (row.status !== "ACTIVE") return null;

  if (row.type === "ONE_OFF") {
    const base = row.send_at_utc ? new Date(row.send_at_utc) : null;
    if (!base) return null;
    const remaining = (items || [])
      .filter((it) => it.enabled !== false)
      .filter((it) => {
        const dueAt = new Date(
          base.getTime() + (Number(it.offset_seconds) || 0) * 1000
        );
        const sent = it.last_sent_at ? new Date(it.last_sent_at) : null;
        return (!sent || sent < base) && dueAt > now;
      })
      .map(
        (it) =>
          new Date(base.getTime() + (Number(it.offset_seconds) || 0) * 1000)
      );
    return remaining.length
      ? new Date(Math.min(...remaining.map((d) => d.getTime())))
      : null;
  }

  if (row.type === "CRON") {
    const base = await computePrevCron(row, now);
    const nextCron = await computeNextCron(row, now);
    if (!base && !nextCron) return null;

    const candidates = [];
    if (nextCron) candidates.push(nextCron);

    if (base) {
      const nextOffsetTime = (items || [])
        .filter((it) => it.enabled !== false)
        .filter((it) => {
          const dueAt = new Date(
            base.getTime() + (Number(it.offset_seconds) || 0) * 1000
          );
          const sent = it.last_sent_at ? new Date(it.last_sent_at) : null;
          return (!sent || sent < base) && dueAt > now;
        })
        .map(
          (it) =>
            new Date(base.getTime() + (Number(it.offset_seconds) || 0) * 1000)
        )
        .sort((a, b) => a - b)[0];
      if (nextOffsetTime) candidates.push(nextOffsetTime);
    }

    if (!candidates.length) return nextCron || null;
    return new Date(Math.min(...candidates.map((d) => d.getTime())));
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

/* ---------------- items helpers ---------------- */
function parseMaybeJSON(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  try {
    const parsed = JSON.parse(val);
    return parsed;
  } catch {
    return val;
  }
}
function toArrayOrNull(val) {
  if (val == null) return null;
  if (Array.isArray(val)) return val.filter((x) => x != null).map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed))
        return parsed.filter((x) => x != null).map(String);
      return [val];
    } catch {
      return [val];
    }
  }
  return null;
}

/** Carry a transient "__remove_existing" flag for PATCH semantics */
function normalizeItemsInput(itemsInput) {
  const raw = Array.isArray(itemsInput)
    ? itemsInput
    : typeof itemsInput === "string"
    ? (() => {
        try {
          const arr = JSON.parse(itemsInput);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      })()
    : Array.isArray(parseMaybeJSON(itemsInput))
    ? parseMaybeJSON(itemsInput)
    : [];

  return raw.map((it, idx) => {
    const media_urls = Array.isArray(it?.media_urls)
      ? it.media_urls
      : undefined;
    const media_url =
      it?.media_url ?? (media_urls ? JSON.stringify(media_urls) : undefined);

    const messages_json =
      it?.messages_json != null
        ? toArrayOrNull(it.messages_json)
        : it?.messages != null
        ? toArrayOrNull(it.messages)
        : null;

    const removeExisting =
      it?.remove_existing === true || it?.removeExisting === true;

    return {
      id: it.id || undefined,
      scheduled_message_id: it.scheduled_message_id || null,
      order_index: typeof it.order_index === "number" ? it.order_index : idx,
      offset_seconds:
        typeof it.offset_seconds === "number"
          ? it.offset_seconds
          : Number(it.offset_seconds) || 0,
      enabled:
        typeof it.enabled === "boolean"
          ? it.enabled
          : it.enabled == null
          ? true
          : !!it.enabled,
      template_id:
        it.template_id == null || it.template_id === ""
          ? null
          : Number(it.template_id),
      body: it.body == null ? null : String(it.body).trim() || null,
      messages_json,
      media_url: media_url == null || media_url === "" ? null : media_url,
      media_json:
        it.media_json == null
          ? null
          : typeof it.media_json === "string"
          ? (() => {
              try {
                return JSON.parse(it.media_json);
              } catch {
                return null;
              }
            })()
          : it.media_json,
      variables_json:
        it.variables_json == null
          ? null
          : typeof it.variables_json === "string"
          ? (() => {
              try {
                return JSON.parse(it.variables_json);
              } catch {
                return null;
              }
            })()
          : it.variables_json,

      // transient flag (not persisted) — used to clear media on PATCH
      __remove_existing: !!removeExisting,
    };
  });
}

async function loadItemsForSchedule(id) {
  return await ScheduledMessageItem.findAll({
    where: { scheduled_message_id: id },
    order: [
      ["order_index", "ASC"],
      ["createdAt", "ASC"],
    ],
  });
}

/* ---------------- bodies & attachments collectors ---------------- */
function _normalizeAttachmentEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const url = entry;
    const name = String(url).split("/").pop() || null;
    return { url, name, mime_type: null, size_bytes: null };
  }
  if (typeof entry === "object") {
    const url = entry.url || entry.href || entry.src || null;
    if (!url) return null;
    return {
      url,
      name: entry.name || (String(url).split("/").pop() || null),
      mime_type: entry.mime_type || entry.type || null,
      size_bytes:
        entry.size_bytes != null
          ? entry.size_bytes
          : entry.size != null
          ? entry.size
          : null,
    };
  }
  return null;
}
function _collectFromMediaFields(media_url, media_json) {
  const out = [];
  if (Array.isArray(media_json)) {
    for (const m of media_json) {
      const n = _normalizeAttachmentEntry(m);
      if (n) out.push(n);
    }
  }
  if (media_url) {
    if (Array.isArray(media_url)) {
      for (const u of media_url) {
        const n = _normalizeAttachmentEntry(u);
        if (n) out.push(n);
      }
    } else if (typeof media_url === "string") {
      let parsed = null;
      try {
        const p = JSON.parse(media_url);
        if (Array.isArray(p)) parsed = p;
      } catch (_) {}
      if (parsed) {
        for (const u of parsed) {
          const n = _normalizeAttachmentEntry(u);
          if (n) out.push(n);
        }
      } else {
        const n = _normalizeAttachmentEntry(media_url);
        if (n) out.push(n);
      }
    }
  }
  // de-dupe by URL
  const uniq = new Map();
  for (const a of out) if (a?.url && !uniq.has(a.url)) uniq.set(a.url, a);
  return Array.from(uniq.values());
}
function collectAttachmentsFromRowAndItems(row, items = []) {
  const all = [];
  for (const it of items) {
    all.push(..._collectFromMediaFields(it.media_url, it.media_json));
  }
  all.push(..._collectFromMediaFields(row.media_url, row.media_json));

  const uniq = new Map();
  for (const a of all) if (a?.url && !uniq.has(a.url)) uniq.set(a.url, a);
  return Array.from(uniq.values());
}
function collectBodiesFromRowAndItems(row, items = []) {
  const bodies = [];

  for (const it of items) {
    if (it?.body && String(it.body).trim()) bodies.push(String(it.body));
    if (Array.isArray(it?.messages_json)) {
      for (const m of it.messages_json) {
        if (typeof m === "string" && m.trim()) bodies.push(m);
      }
    }
  }

  if (row?.body && String(row.body).trim()) bodies.push(String(row.body));
  if (Array.isArray(row?.messages_json)) {
    for (const m of row.messages_json) {
      if (typeof m === "string" && m.trim()) bodies.push(m);
    }
  }

  // de-dupe, keep order
  const seen = new Set();
  const out = [];
  for (const b of bodies) {
    if (!seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
  }
  return out;
}

/* ---------------- core sender ---------------- */
async function deliverItemsForBase(row, items, base, now = new Date()) {
  const dueItems = (items || []).filter((it) => {
    if (it.enabled === false) return false;
    const off = Number(it.offset_seconds) || 0;
    const dueAt = new Date(base.getTime() + off * 1000);
    const last = it.last_sent_at ? new Date(it.last_sent_at) : null;
    const notSentForThisBase = !last || last < base;
    return notSentForThisBase && dueAt <= now;
  });

  if (!dueItems.length && items && items.length) {
    return { sentCount: 0, perItem: [] };
  }

  // Legacy fallback: synthesize single step from parent
  const synthesized =
    !items || items.length === 0
      ? [
          {
            id: null,
            order_index: 0,
            offset_seconds: 0,
            template_id: row.template_id || null,
            body: row.body || null,
            messages_json: row.messages_json || null,
            media_url: row.media_url || null,
            media_json: row.media_json || null,
            variables_json: row.variables_json || null,
            enabled: true,
          },
        ]
      : [];

  const working = dueItems.length ? dueItems : synthesized;

  const recipients = await resolveRecipients(row);
  if (!recipients.length) {
    console.warn(
      `[schedule:${row.id}] No recipients resolved (audience_type=${row.audience_type})`
    );
    return {
      sentCount: 0,
      perItem: working.map((w) => ({
        item_id: w.id || null,
        success: false,
        message: "No recipients resolved",
      })),
    };
  }

  const results = [];
  for (const it of working) {
    // Resolve text(s)
    const tplId = it.template_id || row.template_id || null;

    let baseText = it.body || row.body || "";
    if (tplId) {
      const tpl = await MessageTemplate.findByPk(tplId);
      const candidate = pickTemplateBody(tpl);
      if (candidate) baseText = candidate;
    }

    let messages =
      (Array.isArray(it.messages_json) && it.messages_json.length
        ? it.messages_json
        : Array.isArray(row.messages_json) && row.messages_json.length
        ? row.messages_json
        : null) || null;

    if (!Array.isArray(messages) || messages.length === 0) {
      messages = [baseText];
    }

    // Variables: parent then item (item overrides)
    const mergedVars = Object.assign(
      {},
      row.variables_json || {},
      it.variables_json || {}
    );
    const finalMessages = messages
      .map((m) => applyVars(m, mergedVars))
      .filter((m) => typeof m === "string" && m.trim() !== "");

    // Media: merge item + parent
    const { files, urls } = await mergeMediaSources(
      it.media_url ?? null,
      Array.isArray(it.media_json) ? it.media_json : null,
      row.media_url ?? null,
      Array.isArray(row.media_json) ? row.media_json : null
    );

    // ALWAYS bulk
    const sendResult = await messageService.sendManySameMessage(
      row.business_id,
      recipients,
      finalMessages,
      files,
      urls
    );

    const failedCount = Array.isArray(sendResult?.failedMessages)
      ? sendResult.failedMessages.length
      : sendResult?.success === false
      ? 1
      : 0;

    const ok = failedCount === 0;

    if (it.id && ok) {
      await ScheduledMessageItem.update(
        { last_sent_at: new Date() },
        { where: { id: it.id } }
      );
    }

    results.push({
      item_id: it.id || null,
      success: ok,
      recipients: recipients.length,
      failed: failedCount,
      errors: sendResult.failedMessages || [],
    });
  }

  return { sentCount: results.length, perItem: results };
}

/* ---------------- create ---------------- */
exports.createSchedule = async (
  businessId,
  userId,
  body = {},
  files = [],
  itemFilesByIndex = new Map()
) => {
  const {
    audience_type = "TO_NUMBER",
    to_number = null,
    to_numbers_json = null,
    customer_ids_json = null,
    category_id = null,
    category_ids_json = null,

    template_id = null,
    body: msgBody = null,
    messages_json = null,
    variables_json = null,

    type,
    send_at_utc = null,
    cron_expr = null,
    timezone = SERVER_TZ,
    status = "ACTIVE",

    items,
    items_json,
  } = body;

  if (!["ONE_OFF", "CRON"].includes(type)) throw new Error("Invalid type");
  if (type === "ONE_OFF" && !send_at_utc)
    throw new Error("send_at_utc is required for ONE_OFF");
  if (type === "CRON" && !cron_expr)
    throw new Error("cron_expr is required for CRON");

  // audience validation
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

  // legacy single-message media (when only top-level files are uploaded)
  const media_url = await saveFiles(files);

  const normalizedMessages =
    messages_json == null
      ? null
      : Array.isArray(messages_json)
      ? messages_json
      : toArrayOrNull(messages_json);

  const payload = {
    id: uuidv4(),
    business_id: businessId,
    created_by_user: userId ?? null,

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

    template_id,
    body: msgBody,
    messages_json: normalizedMessages,
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

  const row = await ScheduledMessage.create(payload);

  // Items (multi-message schedule)
  const normalizedItems = normalizeItemsInput(items ?? items_json);
  if (normalizedItems.length) {
    for (let i = 0; i < normalizedItems.length; i++) {
      if (!normalizedItems[i].id) {
        normalizedItems[i].id = uuidv4();
      }

      const bucket = itemFilesByIndex.get(i);
      if (Array.isArray(bucket) && bucket.length) {
        const urlsJson = await saveFiles(bucket);
        if (urlsJson) normalizedItems[i].media_url = urlsJson;
      }
      normalizedItems[i].scheduled_message_id = row.id;
    }
    await ScheduledMessageItem.bulkCreate(normalizedItems, {
      ignoreDuplicates: true,
    });
  }

  const savedItems = normalizedItems.length
    ? await loadItemsForSchedule(row.id)
    : [];
  const nextRun = await computeInitialNextRun(row.toJSON(), savedItems);
  if (nextRun || nextRun === null) {
    await row.update({ next_run_at: nextRun });
  }

  const out = row.toJSON();
  out.items = savedItems.map((i) => i.toJSON());
  return out;
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

  // Whether to include items array verbatim
  const includeItems =
    String(query.include || "").toLowerCase() === "items" ||
    query.includeItems === "1" ||
    query.include_items === "1";

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

  let schedules = rows.map((r) => (tz ? withLocalFields(r, tz) : r.toJSON()));
  if (!schedules.length) {
    return { schedules, total: count, page, limit, timezone: tz || undefined };
  }

  // Load ALL child items to compute bodies & attachments
  const ids = schedules.map((s) => s.id);
  const items = await ScheduledMessageItem.findAll({
    where: { scheduled_message_id: { [Op.in]: ids } },
    attributes: [
      "id",
      "scheduled_message_id",
      "order_index",
      "enabled",
      "template_id",
      "body",
      "messages_json",
      "media_url",
      "media_json",
      "createdAt",
    ],
    order: [
      ["scheduled_message_id", "ASC"],
      ["order_index", "ASC"],
      ["createdAt", "ASC"],
    ],
  });
  const itemsByParent = new Map();
  for (const it of items) {
    const pid = it.scheduled_message_id;
    if (!itemsByParent.has(pid)) itemsByParent.set(pid, []);
    itemsByParent.get(pid).push(it.toJSON ? it.toJSON() : it);
  }

  // Collect templates we may need (when item/parent has template but no text)
  const neededTplIds = new Set();
  for (const s of schedules) {
    const child = itemsByParent.get(s.id) || [];
    if (child.length) {
      for (const it of child) {
        const hasText =
          (typeof it.body === "string" && it.body.trim() !== "") ||
          (Array.isArray(it.messages_json) && it.messages_json.length > 0);
        if (!hasText && it.template_id != null)
          neededTplIds.add(it.template_id);
      }
    } else {
      const parentHasText =
        (typeof s.body === "string" && s.body.trim() !== "") ||
        (Array.isArray(s.messages_json) && s.messages_json.length > 0);
      if (!parentHasText && s.template_id != null) {
        neededTplIds.add(s.template_id);
      }
    }
  }

  // Bulk-load templates once
  const tplMap = new Map();
  if (neededTplIds.size) {
    const tpls = await MessageTemplate.findAll({
      where: { id: { [Op.in]: Array.from(neededTplIds) } },
      attributes: [
        "id",
        "body",
        "content",
        "message",
        "text",
        "text_body",
        "message_en",
        "message_ar",
      ],
    });
    for (const t of tpls) tplMap.set(t.id, t.toJSON ? t.toJSON() : t);
  }

  // Helpers to pull text from items/parent
  const bodiesFromItem = (it) => {
    const out = [];
    if (Array.isArray(it.messages_json) && it.messages_json.length) {
      for (const m of it.messages_json) {
        if (typeof m === "string" && m.trim() !== "") out.push(m);
      }
    }
    if (typeof it.body === "string" && it.body.trim() !== "") {
      out.push(it.body);
    }
    if (!out.length && it.template_id != null) {
      const tpl = tplMap.get(it.template_id);
      const tb = pickTemplateBody(tpl);
      if (typeof tb === "string" && tb.trim() !== "") out.push(tb);
    }
    return out;
  };
  const bodiesFromParent = (s) => {
    const out = [];
    if (Array.isArray(s.messages_json) && s.messages_json.length) {
      for (const m of s.messages_json) {
        if (typeof m === "string" && m.trim() !== "") out.push(m);
      }
    }
    if (typeof s.body === "string" && s.body.trim() !== "") {
      out.push(s.body);
    }
    if (!out.length && s.template_id != null) {
      const tpl = tplMap.get(s.template_id);
      const tb = pickTemplateBody(tpl);
      if (typeof tb === "string" && tb.trim() !== "") out.push(tb);
    }
    return out;
  };

  // Build final schedules with message_bodies + attachments (+items if asked)
  schedules = schedules.map((s) => {
    const its = itemsByParent.get(s.id) || [];
    const message_bodies = its.length
      ? its
          .filter((it) => it.enabled !== false)
          .flatMap((it) => bodiesFromItem(it))
      : bodiesFromParent(s);

    const attachments = collectAttachmentsFromRowAndItems(s, its);

    return includeItems
      ? { ...s, items: its, message_bodies, attachments }
      : { ...s, message_bodies, attachments };
  });

  return { schedules, total: count, page, limit, timezone: tz || undefined };
};

/* ---------------- get ---------------- */
exports.getSchedule = async (businessId, id, tz) => {
  const row = await ScheduledMessage.findOne({
    where: { id, business_id: businessId },
    include: [
      {
        model: ScheduledMessageItem,
        as: "items",
        separate: true,
        order: [
          ["order_index", "ASC"],
          ["createdAt", "ASC"],
        ],
      },
    ],
  });

  if (!row) {
    const err = new Error("Schedule not found");
    err.status = 404;
    throw err;
  }

  const base = tz && isValidIana(tz) ? withLocalFields(row, tz) : row.toJSON();

  // normalized items array (child items or legacy fallback)
  const items =
    typeof row.getAllMessageItems === "function"
      ? row.getAllMessageItems({ includeLegacy: true })
      : base.items || [];

  // bodies & attachments across items + parent
  const message_bodies = collectBodiesFromRowAndItems(base, items);
  const attachments = collectAttachmentsFromRowAndItems(base, items);

  // keep old convenience ‘media’ for preview UIs
  const media =
    typeof row.getMediaItems === "function" ? row.getMediaItems() : [];

  return {
    ...base,
    items,
    message_bodies,
    attachments,
    media,
  };
};

/* ---------------- update ---------------- */
exports.updateSchedule = async (
  businessId,
  id,
  body = {},
  files = [],
  itemFilesByIndex = new Map()
) => {
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
  setIf(
    "messages_json",
    body.messages_json === undefined
      ? undefined
      : Array.isArray(body.messages_json)
      ? body.messages_json
      : typeof body.messages_json === "string"
      ? (() => {
          const arr = toArrayOrNull(body.messages_json);
          return arr;
        })()
      : null
  );
  setIf(
    "variables_json",
    body.variables_json === undefined
      ? undefined
      : typeof body.variables_json === "string"
      ? (() => {
          try {
            return JSON.parse(body.variables_json);
          } catch {
            return null;
          }
        })()
      : body.variables_json
  );

  // schedule
  setIf("type", body.type);
  setIf(
    "send_at_utc",
    body.send_at_utc ? new Date(body.send_at_utc) : body.send_at_utc
  );
  setIf("cron_expr", body.cron_expr);
  setIf("timezone", isValidIana(body.timezone) ? body.timezone : undefined);
  setIf("status", body.status);

  // media (legacy, top-level only)
  const removeMedia =
    body.remove_media === 1 ||
    body.remove_media === "1" ||
    body.remove_media === true;
  if (removeMedia) patch.media_url = null;
  if (Array.isArray(files) && files.length) {
    patch.media_url = await saveFiles(files);
  }

  await row.update(patch);

  // ----- items operations (optional) -----
  const replaceAll = body.items_replace === true || body.items_replace === "1";

  const upserts = normalizeItemsInput(body.items_upsert || []);
  const toCreate = normalizeItemsInput(body.items || body.items_json || []);
  const deleteIds = Array.isArray(body.items_delete_ids)
    ? body.items_delete_ids
    : typeof body.items_delete_ids === "string"
    ? (() => {
        try {
          const arr = JSON.parse(body.items_delete_ids);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      })()
    : [];

  if (replaceAll) {
    await ScheduledMessageItem.destroy({
      where: { scheduled_message_id: row.id },
    });

    // per-item files for replacement set
    for (let i = 0; i < toCreate.length; i++) {
      const bucket = itemFilesByIndex.get(i);
      if (toCreate[i].__remove_existing) {
        toCreate[i].media_url = null;
        toCreate[i].media_json = null;
      }
      if (Array.isArray(bucket) && bucket.length) {
        const urlsJson = await saveFiles(bucket);
        if (urlsJson) toCreate[i].media_url = urlsJson;
      }
      toCreate[i].scheduled_message_id = row.id;
    }
    if (toCreate.length) {
      await ScheduledMessageItem.bulkCreate(toCreate, {
        ignoreDuplicates: true,
      });
    }
  } else {
    if (deleteIds.length) {
      await ScheduledMessageItem.destroy({
        where: { id: { [Op.in]: deleteIds }, scheduled_message_id: row.id },
      });
    }

    if (upserts.length) {
      for (let i = 0; i < upserts.length; i++) {
        const it = upserts[i];

        if (it.__remove_existing) {
          it.media_url = null;
          it.media_json = null;
        }

        const bucket = itemFilesByIndex.get(i);
        if (Array.isArray(bucket) && bucket.length) {
          const urlsJson = await saveFiles(bucket);
          if (urlsJson) it.media_url = urlsJson;
        }

        if (!it.id) it.id = uuidv4();
        it.scheduled_message_id = row.id;

        const [count] = await ScheduledMessageItem.update(
          {
            order_index: it.order_index,
            offset_seconds: it.offset_seconds,
            enabled: it.enabled,
            template_id: it.template_id,
            body: it.body,
            messages_json: it.messages_json,
            media_url: it.media_url ?? null,
            media_json: it.media_json ?? null,
            variables_json: it.variables_json ?? null,
          },
          { where: { id: it.id, scheduled_message_id: row.id } }
        );
        if (!count) {
          await ScheduledMessageItem.create(it);
        }
      }
    }

    if (toCreate.length) {
      for (let i = 0; i < toCreate.length; i++) {
        const bucket = itemFilesByIndex.get(i);
        if (toCreate[i].__remove_existing) {
          toCreate[i].media_url = null;
          toCreate[i].media_json = null;
        }
        if (Array.isArray(bucket) && bucket.length) {
          const urlsJson = await saveFiles(bucket);
          if (urlsJson) toCreate[i].media_url = urlsJson;
        }
        toCreate[i].scheduled_message_id = row.id;
      }
      await ScheduledMessageItem.bulkCreate(toCreate, {
        ignoreDuplicates: true,
      });
    }
  }

  // recompute next_run_at
  const items = await loadItemsForSchedule(row.id);
  const nextRun = await computeInitialNextRun(row.toJSON(), items);
  await row.update({ next_run_at: nextRun });

  const out = row.toJSON();
  out.items = items.map((i) => i.toJSON());
  return out;
};

/* ---------------- status ---------------- */
exports.setStatus = async (businessId, id, newStatus) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(newStatus)) {
    throw new Error("Invalid status");
  }
  const items = await loadItemsForSchedule(row.id);
  const next =
    newStatus === "ACTIVE"
      ? await computeInitialNextRun(row.toJSON(), items)
      : null;
  await row.update({ status: newStatus, next_run_at: next });
  const out = row.toJSON();
  out.items = items.map((i) => i.toJSON());
  return out;
};

/* ---------------- delete ---------------- */
exports.deleteSchedule = async (businessId, id) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  await row.destroy(); // CASCADE removes items
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

/* ---------------- run now ---------------- */
exports.runNow = async (businessId, id) => {
  const row = await ScheduledMessage.findByPk(id);
  if (!row || row.business_id !== businessId)
    throw new Error("Schedule not found");
  if (row.status !== "ACTIVE") return row.toJSON();

  const now = new Date();
  const items = await loadItemsForSchedule(row.id);

  // Determine base tick:
  let base = null;
  if (row.type === "ONE_OFF") {
    base = row.send_at_utc ? new Date(row.send_at_utc) : null;
  } else if (row.type === "CRON") {
    base = await computePrevCron(row, now);
  }

  const sendBundle = await deliverItemsForBase(row, items, base || now, now);

  const patch = { last_run_at: now };
  patch.next_run_at = await computePostRunNextRun(row, items, now);
  await row.update(patch);

  const out = row.toJSON();
  out.sendResult = sendBundle;
  out.items = (await loadItemsForSchedule(row.id)).map((i) => i.toJSON());
  return out;
};

/* ---------------- dispatcher ---------------- */
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
      results.push({
        id: row.id,
        ok: true,
        next_run_at: r.next_run_at,
        result: r.sendResult || null,
      });
    } catch (e) {
      results.push({ id: row.id, ok: false, error: e.message });
    }
  }
  return { processed: results.length, results };
};
