"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");

const customerController = require("../controllers/customerController");
const customerCategoryController = require("../controllers/customerCategoryController");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

const upload = multer({ dest: "uploads/" });

// Customer Categories - MUST be first to avoid /:id route conflicts
router.get(
  "/categories",
  authMiddleware,
  requirePermission("categories.read"),
  customerCategoryController.getCategoriesByUserId
);

router.post(
  "/categories",
  authMiddleware,
  requirePermission("categories.create"),
  customerCategoryController.createCategory
);

// Get categories with search and pagination - MUST be before /:id route
router.get(
  "/categories/search",
  authMiddleware,
  requirePermission("categories.read"),
  customerCategoryController.getCategoriesWithPagination
);

router.put(
  "/categories/:id",
  authMiddleware,
  requirePermission("categories.update"),
  customerCategoryController.updateCategory
);

router.delete(
  "/categories/:id",
  authMiddleware,
  requirePermission("categories.delete"),
  customerCategoryController.deleteCategory
);

// Get category by ID - MUST be last to avoid route conflicts
router.get(
  "/categories/:id",
  authMiddleware,
  requirePermission("categories.read"),
  customerCategoryController.getCategoryById
);

// Download sync report as Excel file
router.get(
  "/sync-report",
  authMiddleware,
  requirePermission("customers.create"),
  customerController.downloadSyncReport
);

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

// Get customer by ID - MUST be last to avoid route conflicts
router.get(
  "/:id",
  authMiddleware,
  requirePermission("customers.read"),
  customerController.getCustomerById
);

module.exports = router;
