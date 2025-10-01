const customerCategoryService = require("../services/customerCategoryService");

exports.createCategory = async (req, res) => {
  try {
    const categoryData = {
      ...req.body,
      user_id: req.user.id, // include the authenticated user's id
    };
    const category = await customerCategoryService.createCategory(categoryData);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await customerCategoryService.getAllCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCategoriesByUserId = async (req, res) => {
  console.log("👤 Authenticated User:", req.user);
  
  try {
    const categories = await customerCategoryService.getAllCategoriesByUser(
      req.user.id
    );
    if (!categories)
      return res.status(404).json({ error: "Categories not found" });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get categories with search and pagination
 * Query parameters: page, limit, search, sortBy, sortOrder
 */
exports.getCategoriesWithPagination = async (req, res) => {
  try {
    console.log("🔍 getCategoriesWithPagination called with params:", req.query);
    console.log("👤 User ID:", req.user?.id);
    
    const {
      page = 0,
      limit = 10,
      search = "",
      sortBy = "name",
      sortOrder = "asc"
    } = req.query;

    // Validate and sanitize parameters
    const pageNum = Math.max(0, parseInt(page) || 0);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const searchTerm = String(search || "").trim();
    const sortField = ['name', 'createdAt', 'updatedAt'].includes(sortBy) ? sortBy : 'name';
    const sortDirection = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'asc';

    console.log("📊 Processed params:", { pageNum, limitNum, searchTerm, sortField, sortDirection });

    const result = await customerCategoryService.getCategoriesWithPagination(
      req.user.id,
      {
        page: pageNum,
        limit: limitNum,
        search: searchTerm,
        sortBy: sortField,
        sortOrder: sortDirection
      }
    );

    console.log("✅ Result:", result);

    res.json({
      success: true,
      data: result.categories,
      pagination: result.pagination,
      search: result.search
    });
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};
exports.getCategoryById = async (req, res) => {
  try {
    const category = await customerCategoryService.getCategoryById(
      req.params.id
    );
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await customerCategoryService.updateCategory(
      req.params.id,
      req.body
    );
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const response = await customerCategoryService.deleteCategory(
      req.params.id
    );
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
