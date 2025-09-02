// src/routes/usageRoutes.js
"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const usageController = require("../controllers/usageController");

// block cross-business access unless you have a separate admin guard
function requireSameBusiness(req, res, next) {
  if (Number(req.params.businessId) !== Number(req.user.business_id)) {
    return res.status(403).json({
      error: "CrossBusinessAccessDenied",
      message: "You cannot access usage for another business.",
    });
  }
  next();
}

// GET /api/usage/my
router.get("/my", auth, usageController.getMyUsage);

// GET /api/usage/businesses/:businessId
router.get(
  "/businesses/:businessId",
  auth,
  requireSameBusiness,
  usageController.getBusinessUsage
);

module.exports = router;
