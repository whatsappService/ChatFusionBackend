// src/controllers/userController.js
"use strict";

const userService = require("../services/userService");
const BusinessPackageService = require("../services/BusinessPackageService");

/** ----- helpers ----- */
function getBizFromReq(req) {
  // prefer explicit path param, fall back to authenticated user's business
  const fromParams = Number(req.params?.businessId || req.params?.bid);
  const fromAuth = Number(req.user?.business_id);
  return fromParams || fromAuth || null;
}

function ensureSameBusinessOrDie(req, res, businessId) {
  const callerBiz = Number(req.user?.business_id || 0);
  if (businessId && callerBiz && businessId !== callerBiz) {
    res.status(403).json({
      error: "CrossBusinessAccessDenied",
      message: "You cannot access users from another business.",
    });
    return false;
  }
  return true;
}

/** ========================= USERS (CRUD) ========================= */

// List all users for a business (enriched with package info)
exports.getAllUsers = async (req, res) => {
  try {
    const businessId = getBizFromReq(req);
    if (!ensureSameBusinessOrDie(req, res, businessId)) return;

    const users = await userService.getAllUsers({ businessId });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to list users" });
  }
};

// Get a single user (enriched with package/custom flags)
exports.getUserById = async (req, res) => {
  try {
    const businessId = getBizFromReq(req);
    if (!ensureSameBusinessOrDie(req, res, businessId)) return;

    const userId = req.params.userId || req.params.id;
    const user = await userService.getUserById(userId, { businessId });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch user" });
  }
};

// Create user → return enriched payload
exports.createUser = async (req, res) => {
  try {
    const businessId = getBizFromReq(req);
    if (!ensureSameBusinessOrDie(req, res, businessId)) return;

    const payload = { ...req.body, business_id: businessId };
    const created = await userService.createUser(payload);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to create user" });
  }
};

// Update user → return enriched payload
exports.updateUser = async (req, res) => {
  try {
    const businessId = getBizFromReq(req);
    if (!ensureSameBusinessOrDie(req, res, businessId)) return;

    const userId = req.params.userId || req.params.id;
    const updatedUser = await userService.updateUser(userId, req.body, {
      businessId,
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
};

// Toggle/patch active flag (PATCH /businesses/:businessId/users/:userId)
exports.patchUser = async (req, res) => {
  try {
    const businessId = getBizFromReq(req);
    if (!ensureSameBusinessOrDie(req, res, businessId)) return;

    const userId = req.params.userId || req.params.id;
    const patch = {};
    if (typeof req.body?.is_active === "boolean") {
      patch.is_active = !!req.body.is_active;
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({
        error: "NothingToPatch",
        message: "Provide a field to patch (e.g., is_active).",
      });
    }
    const updated = await userService.updateUser(userId, patch, { businessId });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to patch user" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const businessId = getBizFromReq(req);
    if (!ensureSameBusinessOrDie(req, res, businessId)) return;

    const userId = req.params.userId || req.params.id;
    await userService.deleteUser(userId);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
};

/** =================== EFFECTIVE ACCESS (READ) ==================== */

// GET /businesses/:businessId/users/:userId/effective-access
// Returns { featuresList: [...], permissions: [...] }
exports.getEffectiveAccess = async (req, res) => {
  try {
    const businessId = getBizFromReq(req);
    if (!ensureSameBusinessOrDie(req, res, businessId)) return;

    const userId = Number(req.params.userId || req.params.id);
    if (!businessId || !userId) {
      return res.status(400).json({
        error: "BadRequest",
        message: "Missing businessId or userId.",
      });
    }

    const eff = await BusinessPackageService.getEffectiveAccessForUser(
      businessId,
      userId
    );

    const featuresList = Array.isArray(eff?.featuresList)
      ? eff.featuresList
      : eff?.features || [];
    const permissions = Array.isArray(eff?.permissions) ? eff.permissions : [];

    res.json({ featuresList, permissions });
  } catch (error) {
    res.status(500).json({
      error: "EffectiveAccessFailed",
      message: error.message || "Failed to get effective access",
    });
  }
};

/** ================= PROFILE / PASSWORD HELPERS ================== */

exports.updateProfile = async (req, res) => {
  try {
    const updatedUser = await userService.updateProfile(req.user.id, req.body);
    res.json(updatedUser);
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "Failed to update profile" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: "BadRequest",
        message: "Both oldPassword and newPassword are required.",
      });
    }
    await userService.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "Failed to change password" });
  }
};

exports.verifyPassword = async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }
    const isValid = await userService.verifyPassword(req.user.id, password);
    if (!isValid) {
      return res.status(401).json({ error: "Incorrect password" });
    }
    res.json({ success: true, message: "Password is valid" });
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Failed to verify password" });
  }
};
