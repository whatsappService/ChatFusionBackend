const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/refresh", authController.refreshToken);
router.get("/me", authMiddleware, authController.getAuthUser); // ✅ Get user from JWT

module.exports = router;
