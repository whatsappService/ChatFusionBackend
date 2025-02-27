const { Op } = require("sequelize");
const BusinessCategory = require("../models/businessCategory");
const MessageTemplate = require("../models/messageTemplate");
const Business = require("../models/business");

exports.createTemplate = async (data) => {
  return await MessageTemplate.create(data);
};

exports.getAllTemplates = async (
  page = 0,
  limit = 10,
  businessId,
  search = ""
) => {
  const offset = page * limit;

  // ✅ Find category_id from Businesses table
  const business = await Business.findOne({
    where: { id: businessId },
    attributes: ["category_id"], // Get only category_id
  });

  if (!business || !business.category_id) {
    return { templates: [], total: 0, page, limit }; // No category found
  }

  const whereCondition = { category_id: business.category_id };

  if (search) {
    whereCondition.template_name = { [Op.like]: `%${search}%` };
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
