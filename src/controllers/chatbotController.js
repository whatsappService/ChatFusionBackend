"use strict";

const svc = require("../services/chatbotService");

exports.getConfig = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    res.json(await svc.getConfig(businessId));
  } catch (e) { next(e); }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    res.json(await svc.updateConfig(businessId, req.body));
  } catch (e) { next(e); }
};

exports.toggleActive = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    res.json(await svc.toggleActive(businessId));
  } catch (e) { next(e); }
};

exports.listIntents = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    res.json(await svc.listIntents(businessId));
  } catch (e) { next(e); }
};

exports.createIntent = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    res.status(201).json(await svc.createIntent(businessId, req.body));
  } catch (e) { next(e); }
};

exports.updateIntent = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    res.json(await svc.updateIntent(businessId, req.params.id, req.body));
  } catch (e) { next(e); }
};

exports.deleteIntent = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    res.json(await svc.deleteIntent(businessId, req.params.id));
  } catch (e) { next(e); }
};

exports.testMessage = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    const { message = "" } = req.body || {};
    res.json(await svc.testMessage(businessId, message));
  } catch (e) { next(e); }
};

exports.importBot = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    const file = req.file; // multer single("file")
    if (!file) return res.status(400).json({ error: "File is required (.json)" });

    const result = await svc.importBot(businessId, file);
    res.json(result);
  } catch (e) { next(e); }
};

exports.exportBot = async (req, res, next) => {
  try {
    const businessId = req.businessId || req.user.business_id;
    const payload = await svc.exportBot(businessId);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", 'attachment; filename="chatbot_export.json"');
    res.send(JSON.stringify(payload, null, 2));
  } catch (e) { next(e); }
};
