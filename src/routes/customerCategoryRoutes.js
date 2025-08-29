"use strict";

const express = require("express");
const router = express.Router();

const customerCategoryController = require("../controllers/customerCategoryController");
const authMiddleware = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

router.post(
  "/",
  authMiddleware,
  requirePermission("categories.create"),
  customerCategoryController.createCategory
);

router.get(
  "/",
  authMiddleware,
  requirePermission("categories.read"),
  customerCategoryController.getCategoriesByUserId
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("categories.read"),
  customerCategoryController.getCategoryById
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("categories.update"),
  customerCategoryController.updateCategory
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("categories.delete"),
  customerCategoryController.deleteCategory
);

module.exports = router;
