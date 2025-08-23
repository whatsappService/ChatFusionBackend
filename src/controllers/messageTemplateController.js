const Business = require("../models/business");
const messageTemplateService = require("../services/messageTemplateService");

exports.createTemplate = async (req, res) => {
  try {
    const { template_name, message_ar, message_en, placeholders } = req.body;
    const userId = req.user.id; // ✅ Get authenticated user ID from JWT

    // ✅ Get the business_id of the user
    const userBusiness = await Business.findOne({
      where: { id: req.user.business_id },
    });

    if (!userBusiness) {
      return res.status(400).json({ error: "User's business not found." });
    }

    // ✅ Get the category_id from the business
    const categoryId = userBusiness.category_id;

    // ✅ Create the message template with the correct category_id
    const newTemplate = await messageTemplateService.createTemplate({
      user_id: userId, // ✅ Set the creator
      category_id: categoryId, // ✅ Auto-set based on business
      template_name,
      message_ar,
      message_en,
      placeholders: JSON.stringify(placeholders || []),
    });

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error("Error creating message template:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAllTemplates = async (req, res) => {
  try {
    const { page = 0, limit = 10, search } = req.query;
    const userId = req.user.id; // ✅ Extract User ID from JWT Token

    const result = await messageTemplateService.getAllTemplates(
      Number(page),
      Number(limit),
      userId, // ✅ Fetch system & user-specific templates
      search
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getTemplateById = async (req, res) => {
  try {
    const template = await messageTemplateService.getTemplateById(
      req.params.id
    );
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const updatedTemplate = await messageTemplateService.updateTemplate(
      req.params.id,
      req.body
    );
    res.json(updatedTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    await messageTemplateService.deleteTemplate(req.params.id);
    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getTemplateCategories = async (req, res) => {
  try {
    const categories = await messageTemplateService.getTemplateCategories(); // ✅ FIX: Use service method
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
