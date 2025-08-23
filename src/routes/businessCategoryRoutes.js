const express = require('express');
const router = express.Router();
const businessCategoryController = require('../controllers/businessCategoryController');

router.post('/', businessCategoryController.createCategory);
router.get('/', businessCategoryController.getAllCategories);
router.get('/:id', businessCategoryController.getCategoryById);
router.put('/:id', businessCategoryController.updateCategory);
router.delete('/:id', businessCategoryController.deleteCategory);

module.exports = router;