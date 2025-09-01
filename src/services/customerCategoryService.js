  const CustomerCategory = require("../models/customerCategory");

  exports.getAllCategories = async () => {
    return await CustomerCategory.findAll();
  };
  exports.getAllCategoriesByUser = async (userId) => {
    // This example assumes your CustomerCategory model has a "user_id" field.
    const categories = await CustomerCategory.findAll({
      where: { user_id: userId },
    });
    return categories;
  };

  exports.getCategoryById = async (id) => {
    return await CustomerCategory.findByPk(id);
  };

  exports.createCategory = async (data) => {
    return await CustomerCategory.create(data);
  };


  exports.updateCategory = async (id, data) => {
    const category = await CustomerCategory.findByPk(id);
    if (!category) throw new Error("Category not found");
    return await category.update(data);
  };

  exports.deleteCategory = async (id) => {
    const category = await CustomerCategory.findByPk(id);
    if (!category) throw new Error("Category not found");
    await category.destroy();
    return { message: "Category deleted successfully" };
  };
