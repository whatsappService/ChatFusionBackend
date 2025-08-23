const BusinessCategory = require('../models/businessCategory');

exports.getAllCategories = async () => {
    return await BusinessCategory.findAll();
};

exports.getCategoryById = async (id) => {
    return await BusinessCategory.findByPk(id);
};

exports.createCategory = async (data) => {
    return await BusinessCategory.create(data);
};

exports.updateCategory = async (id, data) => {
    const category = await BusinessCategory.findByPk(id);
    if (!category) throw new Error('Category not found');
    return await category.update(data);
};

exports.deleteCategory = async (id) => {
    const category = await BusinessCategory.findByPk(id);
    if (!category) throw new Error('Category not found');
    await category.destroy();
    return { message: 'Category deleted successfully' };
};