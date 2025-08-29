"use strict";

const svc = require("../services/webhookService");

exports.getConfig = async (req, res, next) => {
  try {
    res.json(await svc.getConfig(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.updateConfig = async (req, res, next) => {
  try {
    res.json(await svc.updateConfig(req.user.business_id, req.body));
  } catch (e) {
    next(e);
  }
};

exports.rotateSecret = async (req, res, next) => {
  try {
    res.json(await svc.rotateSecret(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.listSubscriptions = async (req, res, next) => {
  try {
    res.json(await svc.listSubscriptions(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.createSubscription = async (req, res, next) => {
  try {
    res
      .status(201)
      .json(await svc.createSubscription(req.user.business_id, req.body));
  } catch (e) {
    next(e);
  }
};

exports.updateSubscription = async (req, res, next) => {
  try {
    res.json(
      await svc.updateSubscription(
        req.user.business_id,
        req.params.id,
        req.body
      )
    );
  } catch (e) {
    next(e);
  }
};

exports.deleteSubscription = async (req, res, next) => {
  try {
    res.json(await svc.deleteSubscription(req.user.business_id, req.params.id));
  } catch (e) {
    next(e);
  }
};

exports.listLogs = async (req, res, next) => {
  try {
    res.json(await svc.listLogs(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.getLog = async (req, res, next) => {
  try {
    res.json(await svc.getLog(req.user.business_id, req.params.id));
  } catch (e) {
    next(e);
  }
};

// Public receiver (no auth)
exports.receive = async (req, res, next) => {
  try {
    const businessId = Number(
      req.get("x-business-id") || req.query.businessId || req.body.businessId
    );
    if (!businessId)
      return res.status(400).json({ error: "Missing businessId" });

    const ok = await svc.verifyAndRecordIncoming(
      businessId,
      req.body,
      req.get("x-webhook-signature") || ""
    );
    if (!ok) return res.status(401).json({ error: "Invalid signature" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
