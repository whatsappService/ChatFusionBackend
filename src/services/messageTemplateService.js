const { Op } = require("sequelize");
const BusinessCategory = require("../models/businessCategory");
const MessageTemplate = require("../models/messageTemplate");
const Business = require("../models/business");

exports.createTemplate = async (data) => {
  return await MessageTemplate.create(data);
};

exports.getAllTemplates = async (page = 0, limit = 10, userId, search = "") => {
  const offset = page * limit;

  const whereCondition = {
    [Op.or]: [
      { user_id: null }, // ✅ System Templates
      { user_id: userId }, // ✅ User's Custom Templates
    ],
  };

  if (search) {
    whereCondition.template_name = { [Op.like]: `%${search}%` }; // ✅ Case-insensitive search
  }

  const { rows: templates, count } = await MessageTemplate.findAndCountAll({
    where: whereCondition,
    offset,
    limit,
  });

  return { templates, total: count, page, limit };
};

exports.getTemplateById = async (id) => {
  return await MessageTemplate.findByPk(id);
};

exports.updateTemplate = async (id, data) => {
  const template = await MessageTemplate.findByPk(id);
  if (!template) throw new Error("Template not found");
  return await template.update(data);
};

exports.deleteTemplate = async (id) => {
  const template = await MessageTemplate.findByPk(id);
  if (!template) throw new Error("Template not found");
  await template.destroy();
  return { message: "Template deleted successfully" };
};
exports.getTemplateCategories = async () => {
  return await BusinessCategory.findAll({
    attributes: ["id", "category_name"],
  }); // ✅ Returns only `id` & `name`
};
