"use strict";
const express = require("express");
const router = express.Router();

const messagePlaceholdersController = require("../controllers/messagePlaceholdersController");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

// List (with ?page=&limit=&search=&include_inactive=0|1)
router.get(
  "/",
  authMiddleware,
  requirePermission("placeholders.read"),
  messagePlaceholdersController.list
);

// Create
router.post(
  "/",
  authMiddleware,
  requirePermission("placeholders.create"),
  messagePlaceholdersController.create
);

// Read by id
router.get(
  "/:id",
  authMiddleware,
  requirePermission("placeholders.read"),
  messagePlaceholdersController.get
);

// Update
router.put(
  "/:id",
  authMiddleware,
  requirePermission("placeholders.update"),
  messagePlaceholdersController.update
);

// Delete (hard delete)
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("placeholders.delete"),
  messagePlaceholdersController.remove
);

module.exports = router;
