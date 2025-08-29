"use strict";

const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/refresh", authController.refreshToken);

// Returns the full rich payload (user + features + toggles + tokens)
router.get("/me", authMiddleware, authController.getAuthUser);

module.exports = router;
