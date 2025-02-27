const messageTemplateService = require("../services/messageTemplateService");

exports.createTemplate = async (req, res) => {
  try {
    const template = await messageTemplateService.createTemplate(req.body);
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllTemplates = async (req, res) => {
  try {
    const { page = 0, limit = 10, search } = req.query;
    const businessId = req.user.business_id; // ✅ Extract business_id from JWT

    if (!businessId) {
      return res.status(400).json({ error: "Business ID is required" });
    }

    const result = await messageTemplateService.getAllTemplates(
      Number(page),
      Number(limit),
      businessId, // ✅ Pass business_id to service
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
