"use strict";

const svc = require("../services/scheduleService");

// Create a schedule (ONE_OFF or CRON)
exports.createSchedule = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const schedule = await svc.createSchedule(businessId, userId, req.body);
    res.status(201).json(schedule);
  } catch (e) {
    next(e);
  }
};

// List
exports.listSchedules = async (req, res, next) => {
  try {
    res.json(await svc.listSchedules(req.user.business_id, req.query));
  } catch (e) {
    next(e);
  }
};

// Get
exports.getSchedule = async (req, res, next) => {
  try {
    res.json(await svc.getSchedule(req.user.business_id, req.params.id));
  } catch (e) {
    next(e);
  }
};

// Update
exports.updateSchedule = async (req, res, next) => {
  try {
    res.json(
      await svc.updateSchedule(req.user.business_id, req.params.id, req.body)
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
    const {
      cron_expr,
      timezone = "Asia/Hebron",
      count = 5,
      from,
    } = req.body || {};
    const rows = await svc.previewNextRuns(
      cron_expr,
      timezone,
      Number(count),
      from
    );
    res.json({ cron_expr, timezone, next: rows });
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
