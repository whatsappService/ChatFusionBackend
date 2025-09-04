"use strict";

const express = require("express");
const router = express.Router();

const businessCategoryController = require("../controllers/businessCategoryController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Public read
router.get("/", businessCategoryController.getAllCategories);
router.get("/:id", businessCategoryController.getCategoryById);

// Admin write
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessCategoryController.createCategory
);
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessCategoryController.updateCategory
);
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessCategoryController.deleteCategory
);

module.exports = router;
