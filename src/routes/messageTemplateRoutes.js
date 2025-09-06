"use strict";
const express = require("express");
const router = express.Router();
const messageTemplateController = require("../controllers/messageTemplateController");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

router.get(
  "/categories",
  authMiddleware,
  requirePermission("templates.read"),
  messageTemplateController.getTemplateCategories
);

router.get(
  "/placeholders", // ⬅️ NEW: global placeholders for UI convenience
  authMiddleware,
  requirePermission("templates.read"),
  messageTemplateController.getGlobalPlaceholders
);

router.post(
  "/",
  authMiddleware,
  requirePermission("templates.create"),
  messageTemplateController.createTemplate
);

router.get(
  "/",
  authMiddleware,
  requirePermission("templates.read"),
  messageTemplateController.getAllTemplates
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("templates.read"),
  messageTemplateController.getTemplateById
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("templates.update"),
  messageTemplateController.updateTemplate
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("templates.delete"),
  messageTemplateController.deleteTemplate
);

module.exports = router;
