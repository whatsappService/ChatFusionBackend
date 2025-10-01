  const CustomerCategory = require("../models/customerCategory");
  const { Op } = require("sequelize");

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

  /**
   * Get categories with search and pagination
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (0-based)
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search term
   * @param {string} options.sortBy - Sort field
   * @param {string} options.sortOrder - Sort order (asc/desc)
   * @returns {Object} Paginated categories with metadata
   */
  exports.getCategoriesWithPagination = async (userId, options = {}) => {
    const {
      page = 0,
      limit = 10,
      search = "",
      sortBy = "name",
      sortOrder = "asc"
    } = options;

    const offset = page * limit;
    const whereCondition = { user_id: userId };

    // Add search functionality
    if (search && search.trim()) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } }
      ];
    }

    // Build order clause
    const order = [[sortBy, sortOrder.toUpperCase()]];

    try {
      const { rows: categories, count } = await CustomerCategory.findAndCountAll({
        where: whereCondition,
        offset,
        limit,
        order,
        attributes: ['id', 'name', 'createdAt', 'updatedAt']
      });

      const totalPages = Math.ceil(count / limit);
      const hasNextPage = page < totalPages - 1;
      const hasPrevPage = page > 0;

      return {
        categories,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? page + 1 : null,
          prevPage: hasPrevPage ? page - 1 : null
        },
        search: {
          term: search,
          results: categories.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
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
