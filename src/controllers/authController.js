// src/controllers/authController.js
"use strict";

const authService = require("../services/authService");
const userService = require("../services/userService");

// Small helper to extract client timezone from header/body/query
function pickClientTz(req) {
  // Express lower-cases header keys, but req.get is case-insensitive too.
  return (
    req.headers["x-timezone"] ||
    req.get("x-timezone") ||
    req.body?.timezone ||
    req.query?.timezone ||
    null
  );
}

exports.login = async (req, res) => {
  try {
    const { email_address, password } = req.body;
    const clientTz = pickClientTz(req);
    const payload = await authService.login(email_address, password, clientTz);
    res.json(payload);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const clientTz = pickClientTz(req);
    const payload = await authService.register({
      ...req.body,
      timezone: req.body?.timezone || clientTz || null,
    });
    res.status(201).json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }
    const clientTz = pickClientTz(req);
    const tokens = await authService.refreshToken(refreshToken, clientTz);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

exports.getAuthUser = async (req, res) => {
  try {
    const uid = req.user?.id ?? req.user?.sub;
    if (!uid) return res.status(401).json({ error: "Unauthenticated" });
    const clientTz = pickClientTz(req);
    const payload = await authService.getAuthUser(uid, clientTz);
    res.json(payload);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

/**
 * PATCH /api/auth/me
 * Accepts { timezone, full_name, phone_number } in body.
 * Also accepts timezone via "x-timezone" header.
 * Returns SAME enriched shape as GET /api/auth/me.
 */
exports.updateMe = async (req, res) => {
  try {
    const uid = req.user?.id ?? req.user?.sub;
    if (!uid) return res.status(401).json({ error: "Unauthenticated" });

    const tzFromHeader = pickClientTz(req);
    const timezone = (req.body?.timezone || tzFromHeader || "").trim();

    // allowlist self-editable fields
    const patch = {};
    if (timezone) patch.timezone = timezone;
    if (typeof req.body?.full_name === "string")
      patch.full_name = req.body.full_name;
    if (typeof req.body?.phone_number === "string")
      patch.phone_number = req.body.phone_number;

    if (Object.keys(patch).length > 0) {
      await userService.updateProfile(uid, patch); // validates timezone inside
    }

    // return enriched payload like GET /me
    const payload = await authService.getAuthUser(uid, tzFromHeader || null);
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
