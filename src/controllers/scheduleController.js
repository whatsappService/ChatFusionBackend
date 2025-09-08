// controllers/scheduleController.js
"use strict";

const svc = require("../services/scheduleService");
const {
  pickTimezone,
  isValidIana,
  toUtcFromLocalISO,
} = require("../utils/timezone");

/** Split uploaded files into top-level and per-item buckets */
function splitItemFiles(all = []) {
  const top = [];
  const byIndex = new Map(); // index -> [File]
  for (const f of all) {
    const name = f.fieldname || "files";
    const m = /^item_files_(\d+)$/.exec(name);
    if (m) {
      const i = Number(m[1]);
      if (!byIndex.has(i)) byIndex.set(i, []);
      byIndex.get(i).push(f);
    } else if (name === "files" || name === "attachments") {
      top.push(f);
    }
  }
  return { top, byIndex };
}

/**
 * Body supports:
 *  - audience: (same as before)
 *  - content: template_id?, body, messages_json? (array of strings), variables_json?
 *  - media: files[] (multipart, legacy), item_files_<index>[] (per-item uploads)
 *  - schedule: type, send_at_local+timezone OR send_at_utc, cron_expr
 *  - status: "ACTIVE" | "PAUSED" | "CANCELLED"
 *  - items / items_json: array of {
 *      id?, order_index?, offset_seconds?, enabled?,
 *      template_id?, body?, messages?/messages_json?,
 *      media_url?/media_urls?/media_json?, variables_json?,
 *      remove_existing? (boolean) // if true on PATCH, clears existing media for that item
 *    }
 *  - PATCH extras:
 *      items_replace: true | "1"
 *      items_upsert: []
 *      items_delete_ids: []
 */
exports.createSchedule = async (req, res, next) => {
  try {
    const tz = pickTimezone(req);
    if (!req.body.timezone || !isValidIana(req.body.timezone)) {
      req.body.timezone = tz;
    }

    if (
      req.body.type === "ONE_OFF" &&
      !req.body.send_at_utc &&
      req.body.send_at_local
    ) {
      const dt = toUtcFromLocalISO(req.body.send_at_local, req.body.timezone);
      if (!dt)
        return res.status(400).json({ message: "Invalid send_at_local" });
      req.body.send_at_utc = dt.toISOString();
    }

    const { top, byIndex } = splitItemFiles(req.files || []);

    const schedule = await svc.createSchedule(
      req.user.business_id,
      req.user.id,
      req.body,
      top,
      byIndex
    );
    res.status(201).json(schedule);
  } catch (e) {
    next(e);
  }
};

exports.listSchedules = async (req, res, next) => {
  try {
    const tz = isValidIana(req.query.timezone)
      ? req.query.timezone
      : pickTimezone(req);
    const result = await svc.listSchedules(req.user.business_id, {
      ...req.query,
      timezone: tz,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

exports.getSchedule = async (req, res, next) => {
  try {
    const tz = isValidIana(req.query.timezone)
      ? req.query.timezone
      : pickTimezone(req);
    const schedule = await svc.getSchedule(
      req.user.business_id,
      req.params.id,
      tz
    );
    res.json(schedule);
  } catch (e) {
    next(e);
  }
};

exports.updateSchedule = async (req, res, next) => {
  try {
    const tz = pickTimezone(req);
    if (!req.body.timezone || !isValidIana(req.body.timezone)) {
      req.body.timezone = tz;
    }

    if (
      req.body.type === "ONE_OFF" &&
      !req.body.send_at_utc &&
      req.body.send_at_local
    ) {
      const dt = toUtcFromLocalISO(req.body.send_at_local, req.body.timezone);
      if (!dt)
        return res.status(400).json({ message: "Invalid send_at_local" });
      req.body.send_at_utc = dt.toISOString();
    }

    const { top, byIndex } = splitItemFiles(req.files || []);

    const updated = await svc.updateSchedule(
      req.user.business_id,
      req.params.id,
      req.body,
      top,
      byIndex
    );
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

exports.pauseSchedule = async (req, res, next) => {
  try {
    res.json(
      await svc.setStatus(req.user.business_id, req.params.id, "PAUSED")
    );
  } catch (e) {
    next(e);
  }
};

exports.resumeSchedule = async (req, res, next) => {
  try {
    res.json(
      await svc.setStatus(req.user.business_id, req.params.id, "ACTIVE")
    );
  } catch (e) {
    next(e);
  }
};

exports.cancelSchedule = async (req, res, next) => {
  try {
    res.json(
      await svc.setStatus(req.user.business_id, req.params.id, "CANCELLED")
    );
  } catch (e) {
    next(e);
  }
};

exports.deleteSchedule = async (req, res, next) => {
  try {
    res.json(await svc.deleteSchedule(req.user.business_id, req.params.id));
  } catch (e) {
    next(e);
  }
};

exports.previewNextRuns = async (req, res, next) => {
  try {
    let {
      cron_expr,
      cronExpr,
      cron,
      expression,
      timezone,
      count = 5,
      from,
    } = req.body || {};

    const rawExpr = (
      cron_expr ||
      cronExpr ||
      cron ||
      expression ||
      req.query?.cron_expr ||
      req.query?.cron ||
      req.query?.expression ||
      ""
    ).trim();

    if (!rawExpr) {
      return res
        .status(400)
        .json({ message: 'Missing "cron_expr". Example: "*/5 * * * *"' });
    }

    const tz = isValidIana(timezone) ? timezone : pickTimezone(req);
    const n = Math.max(1, Math.min(50, Number(count) || 5));

    const rows = await svc.previewNextRuns(rawExpr, tz, n, from);
    res.json({ cron_expr: rawExpr, timezone: tz, next: rows });
  } catch (e) {
    next(e);
  }
};

exports.runNow = async (req, res, next) => {
  try {
    res.json(await svc.runNow(req.user.business_id, req.params.id));
  } catch (e) {
    next(e);
  }
};
