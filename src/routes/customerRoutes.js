"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");

const customerController = require("../controllers/customerController");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

const upload = multer({ dest: "uploads/" });

// Sync from WhatsApp contacts
router.get(
  "/sync-whatsapp-contacts",
  authMiddleware,
  requirePermission("customers.create"),
  customerController.syncWithWhatsApp
);

// Download Excel import template
router.get(
  "/import-template",
  authMiddleware,
  requirePermission("customers.read"),
  customerController.downloadImportTemplate
);

// CRUD
router.post(
  "/",
  authMiddleware,
  requirePermission("customers.create"),
  customerController.addCustomer
);

router.get(
  "/",
  authMiddleware,
  requirePermission("customers.read"),
  customerController.getAllCustomers
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("customers.read"),
  customerController.getCustomerById
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("customers.update"),
  customerController.updateCustomer
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("customers.delete"),
  customerController.deleteCustomer
);

// Import from Excel
router.post(
  "/import",
  authMiddleware,
  requirePermission("customers.create"),
  upload.single("file"),
  customerController.importCustomers
);

module.exports = router;
