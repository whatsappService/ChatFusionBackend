const express = require("express");
const router = express.Router();
const customerCategoryController = require("../controllers/customerCategoryController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, customerCategoryController.createCategory);
router.get("/", authMiddleware,customerCategoryController.getCategoriesByUserId);
router.get("/:id", customerCategoryController.getCategoryById);
router.put("/:id", customerCategoryController.updateCategory);
router.delete("/:id", customerCategoryController.deleteCategory);

module.exports = router;
