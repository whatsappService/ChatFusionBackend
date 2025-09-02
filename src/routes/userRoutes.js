// src/routes/users.js
"use strict";

const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

// ---------- helpers ----------
const canRead = requirePermission(["users.read", "users.manage", "*"]);
const canWrite = requirePermission(["users.write", "users.manage", "*"]);
const canManage = requirePermission(["users.manage", "*"]);

// ======== Flat shape (/users) for backwards compatibility ========
router.get("/", auth, canRead, userController.getAllUsers);
router.post("/", auth, canWrite, userController.createUser);

router.get("/:id", auth, canRead, userController.getUserById);
router.put("/:id", auth, canWrite, userController.updateUser);
router.patch("/:id", auth, canWrite, userController.patchUser);
router.delete("/:id", auth, canManage, userController.deleteUser);

// ======== Business-scoped shape (/businesses/:businessId/users) ========
router.get(
  "/businesses/:businessId/users",
  auth,
  canRead,
  userController.getAllUsers
);
router.post(
  "/businesses/:businessId/users",
  auth,
  canWrite,
  userController.createUser
);

router.get(
  "/businesses/:businessId/users/:userId",
  auth,
  canRead,
  userController.getUserById
);
router.put(
  "/businesses/:businessId/users/:userId",
  auth,
  canWrite,
  userController.updateUser
);
router.patch(
  "/businesses/:businessId/users/:userId",
  auth,
  canWrite,
  userController.patchUser
);
router.delete(
  "/businesses/:businessId/users/:userId",
  auth,
  canManage,
  userController.deleteUser
);

// Effective access for a user (UI: UsersApi.getEffectiveAccess)
router.get(
  "/businesses/:businessId/users/:userId/effective-access",
  auth,
  canRead,
  userController.getEffectiveAccess
);

// Self-service
router.post("/me/update-profile", auth, userController.updateProfile);
router.post("/me/change-password", auth, userController.changePassword);
router.post("/me/verify-password", auth, userController.verifyPassword);

module.exports = router;
