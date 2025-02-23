const express = require('express');
const router = express.Router();
const customerCategoryController = require('../controllers/customerCategoryController');

router.post('/', customerCategoryController.createCategory);
router.get('/', customerCategoryController.getAllCategories);
router.get('/:id', customerCategoryController.getCategoryById);
router.put('/:id', customerCategoryController.updateCategory);
router.delete('/:id', customerCategoryController.deleteCategory);

module.exports = router;