"use strict";

const svc = require("../services/analyticsService");

exports.getOverview = async (req, res, next) => {
  try {
    res.json(await svc.getOverview(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.getDailyMessages = async (req, res, next) => {
  try {
    res.json(await svc.getDailyMessages(req.user.business_id, req.query));
  } catch (e) {
    next(e);
  }
};

exports.getDeliverability = async (req, res, next) => {
  try {
    res.json(await svc.getDeliverability(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.getContactsGrowth = async (req, res, next) => {
  try {
    res.json(await svc.getContactsGrowth(req.user.business_id, req.query));
  } catch (e) {
    next(e);
  }
};

exports.getTemplateUsage = async (req, res, next) => {
  try {
    res.json(await svc.getTemplateUsage(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const csv = await svc.exportCsv(req.user.business_id);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="analytics_overview.csv"'
    );
    res.send(csv);
  } catch (e) {
    next(e);
  }
};
