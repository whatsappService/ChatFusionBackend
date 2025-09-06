"use strict";

const messagePlaceholdersService = require("../services/messagePlaceholdersService");

// tiny helper: normalize booleans from query strings
const toBool = (v, def = false) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(s);
};

class MessagePlaceholdersController {
  static async list(req, res, next) {
    try {
      const { page = 0, limit = 50, search, include_inactive } = req.query;
      const result = await messagePlaceholdersService.list(
        Number(page),
        Number(limit),
        search || "",
        toBool(include_inactive, false)
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  }

  static async get(req, res, next) {
    try {
      const id = Number(req.params.id);
      const item = await messagePlaceholdersService.getById(id);
      if (!item) return res.status(404).json({ error: "NotFound" });
      res.json(item);
    } catch (e) {
      next(e);
    }
  }

  static async create(req, res, next) {
    try {
      const payload = MessagePlaceholdersController._validatePayload(
        req.body,
        true
      );
      const created = await messagePlaceholdersService.create(payload);
      res
        .status(201)
        .location(`/api/message-placeholders/${created.id}`)
        .json(created);
    } catch (e) {
      if (e.name === "ValidationError" || e.status === 400) {
        return res.status(400).json({ error: e.message });
      }
      next(e);
    }
  }

  static async update(req, res, next) {
    try {
      const id = Number(req.params.id);
      const existing = await messagePlaceholdersService.getById(id);
      if (!existing) return res.status(404).json({ error: "NotFound" });

      const payload = MessagePlaceholdersController._validatePayload(
        req.body,
        false
      );
      const updated = await messagePlaceholdersService.update(id, payload);
      res.json(updated);
    } catch (e) {
      if (e.name === "ValidationError" || e.status === 400) {
        return res.status(400).json({ error: e.message });
      }
      next(e);
    }
  }

  static async remove(req, res, next) {
    try {
      const id = Number(req.params.id);
      const existing = await messagePlaceholdersService.getById(id);
      if (!existing) return res.status(404).json({ error: "NotFound" });

      await messagePlaceholdersService.remove(id);
      res.json({ message: "Placeholder deleted successfully" });
    } catch (e) {
      next(e);
    }
  }

  // -------- helpers --------
  static _validatePayload(body, isCreate) {
    const err = (msg) => {
      const e = new Error(msg);
      e.name = "ValidationError";
      e.status = 400;
      throw e;
    };

    const allowed = [
      "code",
      "name_en",
      "name_ar",
      "description_en",
      "description_ar",
      "example_en",
      "example_ar",
      "is_active",
    ];
    const payload = {};
    for (const k of allowed) {
      if (body[k] !== undefined) payload[k] = body[k];
    }

    if (isCreate && !payload.code) err("code is required");
    if (payload.code) {
      // codes are saved without braces, e.g. "first_name"
      const ok = /^[a-z0-9_]{2,128}$/i.test(String(payload.code).trim());
      if (!ok) err("code must match /^[a-z0-9_]{2,128}$/");
      payload.code = String(payload.code).trim();
    }

    if (payload.is_active !== undefined) {
      payload.is_active = Boolean(payload.is_active);
    }

    return payload;
  }
}

module.exports = MessagePlaceholdersController;
