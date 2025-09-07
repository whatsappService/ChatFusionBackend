"use strict";

const svc = require("../services/scheduleService");
const {
  pickTimezone,
  isValidIana,
  toUtcFromLocalISO,
} = require("../utils/timezone");

// Create a schedule (ONE_OFF or CRON)
exports.createSchedule = async (req, res, next) => {
  try {
    // Resolve/normalize timezone for this request
    const tz = pickTimezone(req);

    // Ensure a valid timezone lives on the body (service persists it)
    if (!req.body.timezone || !isValidIana(req.body.timezone)) {
      req.body.timezone = tz;
    }

    // If a ONE_OFF was sent with local time, convert -> UTC
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

    const businessId = req.user.business_id;
    const userId = req.user.id;
    const schedule = await svc.createSchedule(
      businessId,
      userId,
      req.body,
      req.files || []
    );
    res.status(201).json(schedule);
  } catch (e) {
    next(e);
  }
};

// List
exports.listSchedules = async (req, res, next) => {
  try {
    // Allow timezone in query to return convenience *_local fields
    if (!isValidIana(req.query.timezone)) {
      delete req.query.timezone; // ignore invalid tz in list view
    }
    res.json(await svc.listSchedules(req.user.business_id, req.query));
  } catch (e) {
    next(e);
  }
};

// Get
exports.getSchedule = async (req, res, next) => {
  try {
    const tz = req.query.timezone;
    if (tz && !isValidIana(tz)) delete req.query.timezone;
    res.json(
      await svc.getSchedule(
        req.user.business_id,
        req.params.id,
        req.query.timezone
      )
    );
  } catch (e) {
    next(e);
  }
};

// Update
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

    res.json(
      await svc.updateSchedule(
        req.user.business_id,
        req.params.id,
        req.body,
        req.files || []
      )
    );
  } catch (e) {
    next(e);
  }
};

// State transitions
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

// Delete
exports.deleteSchedule = async (req, res, next) => {
  try {
    res.json(await svc.deleteSchedule(req.user.business_id, req.params.id));
  } catch (e) {
    next(e);
  }
};

// Preview CRON
exports.previewNextRuns = async (req, res, next) => {
  try {
    // Accept multiple aliases + query fallback
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

    // Use provided tz if valid; else pick from request (header/user/fallback)
    const tz = isValidIana(timezone) ? timezone : pickTimezone(req);
    const n = Math.max(1, Math.min(50, Number(count) || 5));

    const rows = await svc.previewNextRuns(rawExpr, tz, n, from);
    res.json({ cron_expr: rawExpr, timezone: tz, next: rows });
  } catch (e) {
    next(e);
  }
};

// Run now
exports.runNow = async (req, res, next) => {
  try {
    res.json(await svc.runNow(req.user.business_id, req.params.id));
  } catch (e) {
    next(e);
  }
};
