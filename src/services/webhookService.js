"use strict";

const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { Feature, BusinessFeature } = require("../models/associations");

async function getOrInitBF(business_id) {
  const feature = await Feature.findOne({ where: { code: "webhooks" } });
  if (!feature) throw new Error("Feature 'webhooks' not found");

  let bf = await BusinessFeature.findOne({ where: { business_id, feature_id: feature.id } });
  if (!bf) {
    bf = await BusinessFeature.create({
      business_id, feature_id: feature.id, enabled: true,
      meta_json: { secret: crypto.randomBytes(24).toString("hex"), config: { retries: 3, timeoutMs: 5000 }, subscriptions: [], logs: [] }
    });
  }
  const meta = bf.meta_json || {};
  meta.secret ||= crypto.randomBytes(24).toString("hex");
  meta.config ||= { retries: 3, timeoutMs: 5000 };
  meta.subscriptions ||= [];
  meta.logs ||= [];
  bf.meta_json = meta;
  return { bf, feature };
}

function appendLog(bf, entry) {
  const meta = bf.meta_json || {};
  meta.logs ||= [];
  meta.logs.unshift({ id: uuidv4(), ts: new Date().toISOString(), ...entry });
  meta.logs = meta.logs.slice(0, 200);
  bf.meta_json = meta;
}

exports.getConfig = async (business_id) => {
  const { bf } = await getOrInitBF(business_id);
  return { enabled: !!bf.enabled, secretMasked: bf.meta_json.secret ? "********" : null, config: bf.meta_json.config };
};

exports.updateConfig = async (business_id, patch) => {
  const { bf } = await getOrInitBF(business_id);
  const { enabled, config } = patch || {};
  if (typeof enabled === "boolean") bf.enabled = enabled;
  if (config && typeof config === "object") bf.meta_json.config = { ...bf.meta_json.config, ...config };
  await bf.save();
  return { ok: true, enabled: bf.enabled, config: bf.meta_json.config };
};

exports.rotateSecret = async (business_id) => {
  const { bf } = await getOrInitBF(business_id);
  bf.meta_json.secret = crypto.randomBytes(24).toString("hex");
  await bf.save();
  return { ok: true };
};

exports.listSubscriptions = async (business_id) => {
  const { bf } = await getOrInitBF(business_id);
  return bf.meta_json.subscriptions || [];
};

exports.createSubscription = async (business_id, { event, url, active = true }) => {
  if (!event || !url) { const e = new Error("event and url are required"); e.status = 400; throw e; }
  const { bf } = await getOrInitBF(business_id);
  const subs = bf.meta_json.subscriptions || [];
  const sub = { id: uuidv4(), event, url, active: !!active };
  subs.push(sub);
  bf.meta_json.subscriptions = subs;
  await bf.save();
  return sub;
};

exports.updateSubscription = async (business_id, id, patch) => {
  const { bf } = await getOrInitBF(business_id);
  const subs = bf.meta_json.subscriptions || [];
  const idx = subs.findIndex((s) => s.id === id);
  if (idx === -1) { const e = new Error("Subscription not found"); e.status = 404; throw e; }
  const { event, url, active } = patch || {};
  if (event) subs[idx].event = event;
  if (url) subs[idx].url = url;
  if (typeof active === "boolean") subs[idx].active = active;
  bf.meta_json.subscriptions = subs;
  await bf.save();
  return subs[idx];
};

exports.deleteSubscription = async (business_id, id) => {
  const { bf } = await getOrInitBF(business_id);
  const subs = bf.meta_json.subscriptions || [];
  const nextSubs = subs.filter((s) => s.id !== id);
  if (nextSubs.length === subs.length) { const e = new Error("Subscription not found"); e.status = 404; throw e; }
  bf.meta_json.subscriptions = nextSubs;
  await bf.save();
  return { ok: true };
};

exports.listLogs = async (business_id) => {
  const { bf } = await getOrInitBF(business_id);
  return bf.meta_json.logs || [];
};

exports.getLog = async (business_id, id) => {
  const { bf } = await getOrInitBF(business_id);
  const log = (bf.meta_json.logs || []).find((l) => l.id === id);
  if (!log) { const e = new Error("Log not found"); e.status = 404; throw e; }
  return log;
};

// Public receiver helpers
exports.verifyAndRecordIncoming = async (business_id, body, signatureHeader) => {
  const { bf } = await getOrInitBF(business_id);
  const secret = bf.meta_json.secret;
  const raw = JSON.stringify(body || {});
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const ok = !!signatureHeader && crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  appendLog(bf, { kind: "incoming", valid: ok, payload: body });
  await bf.save();
  return ok;
};
