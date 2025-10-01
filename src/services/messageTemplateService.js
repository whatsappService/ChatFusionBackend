  const { Op } = require("sequelize");
  const BusinessCategory = require("../models/businessCategory");
  const MessageTemplate = require("../models/messageTemplate");
  const MessagesPlaceholder = require("../models/messagesPlaceholder"); // ⬅️ global placeholders

  // Only real columns (no placeholders on MessageTemplates)
  const TEMPLATE_FIELDS = [
    "id",
    "business_id",
    "category_id",
    "template_name_en",
    "template_name_ar",
    "message_en",
    "message_ar",
    "createdAt",
    "updatedAt",
  ];

  exports.createTemplate = async (data) => {
    // keep only known fields (defensive against legacy clients)
    const allowed = new Set(
      TEMPLATE_FIELDS.filter((f) => !["id", "createdAt", "updatedAt"].includes(f))
    );
    const clean = {};
    for (const k in data || {}) if (allowed.has(k)) clean[k] = data[k];
    return await MessageTemplate.create(clean);
  };

  exports.getTemplates = async (
    page = 0,
    limit = 10,
    businessId,
    search = ""
  ) => {
    const offset = page * limit;

    const whereCondition = {
      [Op.or]: [{ business_id: null }, { business_id: businessId }],
    };

    if (search) {
      whereCondition[Op.and] = [
        {
          [Op.or]: [
            { template_name_en: { [Op.like]: `%${search}%` } },
            { template_name_ar: { [Op.like]: `%${search}%` } },
            { message_en: { [Op.like]: `%${search}%` } },
            { message_ar: { [Op.like]: `%${search}%` } },
          ],
        },
      ];
    }

    const { rows: templates, count } = await MessageTemplate.findAndCountAll({
      attributes: TEMPLATE_FIELDS,
      where: whereCondition,
      offset,
      limit,
      order: [["updatedAt", "DESC"]],
    });

    return { templates, total: count, page, limit };
  };

  exports.getAllTemplates = async (
    page = 0,
    limit = 10,
    businessId,
    search = ""
  ) => {
    const offset = page * limit;

    const whereCondition = {
      [Op.or]: [{ business_id: null }, { business_id: businessId }],
    };

    if (search) {
      whereCondition[Op.and] = [
        {
          [Op.or]: [
            { template_name_en: { [Op.like]: `%${search}%` } },
            { template_name_ar: { [Op.like]: `%${search}%` } },
            { message_en: { [Op.like]: `%${search}%` } },
            { message_ar: { [Op.like]: `%${search}%` } },
          ],
        },
      ];
    }

    const { rows: templates, count } = await MessageTemplate.findAndCountAll({
      attributes: TEMPLATE_FIELDS,
      where: whereCondition,
      offset,
      limit,
      order: [["updatedAt", "DESC"]],
    });

    return { templates, total: count, page, limit };
  };

  exports.getTemplateById = async (id) => {
    return await MessageTemplate.findByPk(id, {
      attributes: TEMPLATE_FIELDS,
    });
  };

  exports.updateTemplate = async (id, data) => {
    const template = await MessageTemplate.findByPk(id, {
      attributes: TEMPLATE_FIELDS,
    });
    if (!template) throw new Error("Template not found");

    // sanitize update payload
    const allowed = new Set(
      TEMPLATE_FIELDS.filter((f) => !["id", "createdAt", "updatedAt"].includes(f))
    );
    const clean = {};
    for (const k in data || {}) if (allowed.has(k)) clean[k] = data[k];

    return await template.update(clean);
  };

  exports.deleteTemplate = async (id) => {
    const template = await MessageTemplate.findByPk(id, {
      attributes: TEMPLATE_FIELDS,
    });
    if (!template) throw new Error("Template not found");
    await template.destroy();
    return { message: "Template deleted successfully" };
  };

  exports.getTemplateCategories = async () => {
    return await BusinessCategory.findAll({
      attributes: ["id", ["category_name", "name"]],
    });
  };

  // ⬇️ NEW: global placeholders for UI (active only; sorted by code)
  exports.getGlobalPlaceholders = async () => {
    return await MessagesPlaceholder.findAll({
      where: { is_active: true },
      attributes: [
        "id",
        "code",
        "name_en",
        "name_ar",
        "description_en",
        "description_ar",
        "example_en",
        "example_ar",
      ],
      order: [["code", "ASC"]],
    });
  };
