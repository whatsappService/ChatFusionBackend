"use strict";

const crypto = require("crypto");
const { Business } = require("../models/associations");

const maskKey = (k) => (!k ? null : (k.length <= 8 ? "*".repeat(k.length) : k.slice(0,4) + "*".repeat(k.length-8) + k.slice(-4)));
const genKey = () => crypto.randomBytes(48).toString("base64url"); // switch to hex if preferred

exports.listKeys = async (business_id) => {
  const biz = await Business.findByPk(business_id);
  return [{ id: "primary", label: "Primary", masked: maskKey(biz.api_key), createdAt: biz.updatedAt }];
};

exports.createKey = async (business_id) => {
  const biz = await Business.findByPk(business_id);
  const key = genKey();
  biz.api_key = key;
  await biz.save();
  return { id: "primary", label: "Primary", api_key: key };
};

exports.getKey = async (business_id) => {
  const biz = await Business.findByPk(business_id);
  if (!biz.api_key) { const e = new Error("No API key"); e.status = 404; throw e; }
  return { id: "primary", label: "Primary", masked: maskKey(biz.api_key) };
};

exports.updateKey = async () => {
  const e = new Error("Nothing to update for API key. Use rotate or revoke.");
  e.status = 400;
  throw e;
};

exports.rotateKey = async (business_id) => {
  const biz = await Business.findByPk(business_id);
  const key = genKey();
  biz.api_key = key;
  await biz.save();
  return { id: "primary", label: "Primary", api_key: key };
};

exports.revokeKey = async (business_id) => {
  const biz = await Business.findByPk(business_id);
  biz.api_key = null;
  await biz.save();
  return { ok: true };
};

exports.deleteKey = exports.revokeKey;

exports.listScopes = async () => ([
  { code: "messages.send.single",    description: "Send single message" },
  { code: "messages.send.bulk",    description: "Send bulk messages" },
  { code: "schedules.manage", description: "Create/update schedules" },
  { code: "media.upload",     description: "Attach media" },
  { code: "customers.read",   description: "Read customers" },
  { code: "templates.read",   description: "Read message templates" },
  { code: "webhooks.manage",  description: "Manage webhooks" },
  { code: "analytics.read",   description: "Read analytics" },
]);
