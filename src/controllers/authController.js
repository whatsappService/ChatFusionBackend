"use strict";

const authService = require("../services/authService");

exports.login = async (req, res) => {
  try {
    const { email_address, password } = req.body;
    const payload = await authService.login(email_address, password);
    res.json(payload); // tokens, user, features, permissions...
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const payload = await authService.register(req.body);
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
    const tokens = await authService.refreshToken(refreshToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

// controllers/authController.js
exports.getAuthUser = async (req, res) => {
  try {
    const uid = req.user?.id ?? req.user?.sub;
    if (!uid) return res.status(401).json({ error: "Unauthenticated" });
    const payload = await authService.getAuthUser(uid);
    res.json(payload);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};
