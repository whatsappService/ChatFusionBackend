"use strict";

const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/refresh", authController.refreshToken);

// Returns the full rich payload (user + features + permissions)
router.get("/me", authMiddleware, authController.getAuthUser);

// ✅ NEW: update current user (e.g., timezone) and return the same enriched payload
router.patch("/me", authMiddleware, authController.updateMe);

module.exports = router;
