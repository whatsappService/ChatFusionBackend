"use strict";

const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");
const apiAccessController = require("../controllers/apiAccessController");

const router = express.Router();

const chain = [
  authenticateUser,
  requireFeature("api_access"),
  requirePermission("api.manage"),
];

router.get("/keys", ...chain, apiAccessController.listKeys);
router.post("/keys", ...chain, apiAccessController.createKey);
router.get("/keys/:id", ...chain, apiAccessController.getKey);
router.patch("/keys/:id", ...chain, apiAccessController.updateKey);
router.post("/keys/:id/rotate", ...chain, apiAccessController.rotateKey);
router.post("/keys/:id/revoke", ...chain, apiAccessController.revokeKey);
router.delete("/keys/:id", ...chain, apiAccessController.deleteKey);

// Catalog of scopes
router.get("/scopes", ...chain, apiAccessController.listScopes);

module.exports = router;
