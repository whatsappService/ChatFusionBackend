"use strict";

const { v4: uuidv4 } = require("uuid");
const { Feature, BusinessFeature } = require("../models/associations");

// Ensure we have an enabled BusinessFeature row for ai_chatbot,
// and that meta_json has defaults.
async function getOrInit(business_id) {
  const feature = await Feature.findOne({ where: { code: "ai_chatbot" } });
  if (!feature) {
    const err = new Error("Feature 'ai_chatbot' not found. Seed Features table.");
    err.status = 500;
    throw err;
  }

  let bf = await BusinessFeature.findOne({
    where: { business_id, feature_id: feature.id },
  });

  if (!bf) {
    bf = await BusinessFeature.create({
      business_id,
      feature_id: feature.id,
      enabled: true, // default on; your seeder should control this
      meta_json: {},
    });
  }

  // Defaults
  const meta = bf.meta_json || {};
  meta.config ||= {
    active: true,
    welcomeMessage: "Hello! How can I help you?",
    fallbackMessage: "Sorry, I didn’t understand. Please rephrase.",
    language: "en",
  };
  meta.intents ||= [
    // sample starter intent
    {
      id: uuidv4(),
      name: "greeting",
      keywords: ["hi", "hello", "hey", "مرحبا"],
      reply: "Hi there 👋",
      active: true,
    },
  ];

  bf.meta_json = meta;
  await bf.save();

  return bf;
}

exports.getConfig = async (business_id) => {
  const bf = await getOrInit(business_id);
  return { enabled: !!bf.enabled, config: bf.meta_json.config };
};

exports.updateConfig = async (business_id, patch = {}) => {
  const bf = await getOrInit(business_id);
  const cfg = bf.meta_json.config || {};
  bf.meta_json.config = { ...cfg, ...patch };
  await bf.save();
  return { ok: true, config: bf.meta_json.config };
};

exports.toggleActive = async (business_id) => {
  const bf = await getOrInit(business_id);
  const cfg = bf.meta_json.config || {};
  cfg.active = !cfg.active;
  bf.meta_json.config = cfg;
  await bf.save();
  return { ok: true, active: cfg.active };
};

exports.listIntents = async (business_id) => {
  const bf = await getOrInit(business_id);
  return { intents: bf.meta_json.intents || [] };
};

exports.createIntent = async (business_id, data = {}) => {
  const bf = await getOrInit(business_id);
  const intents = bf.meta_json.intents || [];

  const intent = {
    id: uuidv4(),
    name: String(data.name || "unnamed"),
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    reply: String(data.reply || ""),
    active: data.active !== false,
  };

  intents.push(intent);
  bf.meta_json.intents = intents;
  await bf.save();
  return intent;
};

exports.updateIntent = async (business_id, id, patch = {}) => {
  const bf = await getOrInit(business_id);
  const intents = bf.meta_json.intents || [];
  const idx = intents.findIndex((i) => i.id === id);
  if (idx === -1) {
    const e = new Error("Intent not found");
    e.status = 404;
    throw e;
  }
  const cur = intents[idx];
  intents[idx] = {
    ...cur,
    ...("name" in patch ? { name: String(patch.name) } : {}),
    ...("reply" in patch ? { reply: String(patch.reply) } : {}),
    ...("active" in patch ? { active: !!patch.active } : {}),
    ...(Array.isArray(patch.keywords) ? { keywords: patch.keywords } : {}),
  };
  bf.meta_json.intents = intents;
  await bf.save();
  return intents[idx];
};

exports.deleteIntent = async (business_id, id) => {
  const bf = await getOrInit(business_id);
  const intents = bf.meta_json.intents || [];
  const next = intents.filter((i) => i.id !== id);
  if (next.length === intents.length) {
    const e = new Error("Intent not found");
    e.status = 404;
    throw e;
  }
  bf.meta_json.intents = next;
  await bf.save();
  return { ok: true };
};

exports.testMessage = async (business_id, message = "") => {
  const bf = await getOrInit(business_id);
  const { config, intents } = bf.meta_json;
  if (!config.active) {
    return { matched: false, reply: config.fallbackMessage, intent: null };
  }

  const text = String(message || "").toLowerCase();
  let best = null;

  // naive keyword match scoring
  for (const intent of intents) {
    if (!intent.active) continue;
    const score = (intent.keywords || []).reduce(
      (acc, kw) => (text.includes(String(kw).toLowerCase()) ? acc + 1 : acc),
      0
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { score, intent };
    }
  }

  if (best) {
    return { matched: true, reply: best.intent.reply, intent: best.intent };
  }
  return { matched: false, reply: config.fallbackMessage, intent: null };
};

exports.importBot = async (business_id, file) => {
  // Expect JSON file with shape: { config: {...}, intents: [...] }
  const text = file.buffer.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const e = new Error("Invalid JSON file");
    e.status = 400;
    throw e;
  }

  const bf = await getOrInit(business_id);
  const cfg = parsed.config && typeof parsed.config === "object" ? parsed.config : bf.meta_json.config;
  const intents = Array.isArray(parsed.intents) ? parsed.intents : bf.meta_json.intents;

  // normalize intents (ensure id + shape)
  const normalized = intents.map((i) => ({
    id: i.id || uuidv4(),
    name: String(i.name || "unnamed"),
    keywords: Array.isArray(i.keywords) ? i.keywords : [],
    reply: String(i.reply || ""),
    active: i.active !== false,
  }));

  bf.meta_json = {
    ...bf.meta_json,
    config: { ...bf.meta_json.config, ...cfg },
    intents: normalized,
  };
  await bf.save();

  return { ok: true, counts: { intents: normalized.length } };
};

exports.exportBot = async (business_id) => {
  const bf = await getOrInit(business_id);
  return {
    config: bf.meta_json.config || {},
    intents: bf.meta_json.intents || [],
    exportedAt: new Date().toISOString(),
  };
};
