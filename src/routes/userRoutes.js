"use strict";

const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const auth = require("../middleware/authMiddleware");

// ---------- helpers ----------
const requirePermission = require("../middleware/requirePermission");

const canRead = requirePermission(["users.read", "users.manage", "*"]);
const canWrite = requirePermission(["users.write", "users.manage", "*"]);
const canManage = requirePermission(["users.manage", "*"]);

// ======== Flat shape (/users) with precise perms ========
router.get(
  "/",
  auth,
  requirePermission(["users.view", "*"]),
  userController.getAllUsers
);
router.post(
  "/",
  auth,
  requirePermission(["users.create", "*"]),
  userController.createUser
);
router.get(
  "/:id",
  auth,
  requirePermission(["users.view", "*"]),
  userController.getUserById
);
router.put(
  "/:id",
  auth,
  requirePermission(["users.update", "*"]),
  userController.updateUser
);
router.patch(
  "/:id",
  auth,
  requirePermission(["users.update", "*"]),
  userController.patchUser
);
router.delete(
  "/:id",
  auth,
  requirePermission(["users.delete", "*"]),
  userController.deleteUser
);

// ======== Business-scoped shape ========
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

// Effective access for a user
router.get(
  "/businesses/:businessId/users/:userId/effective-access",
  auth,
  canRead,
  requirePermission(["users.view", "*"]),
  userController.getEffectiveAccess
);

// Self-service
router.post("/me/update-profile", auth, userController.updateProfile);
router.post("/me/change-password", auth, userController.changePassword);
router.post("/me/verify-password", auth, userController.verifyPassword);

module.exports = router;
