const Business = require("../models/business");
const messageTemplateService = require("../services/messageTemplateService");

exports.createTemplate = async (req, res) => {
  try {
    const {
      template_name_en,
      template_name_ar,
      message_ar,
      message_en,
      // placeholders,  // ⛔️ removed from request
    } = req.body;
    const businessId = req.user.business_id;

    // confirm business exists and fetch category
    const userBusiness = await Business.findOne({ where: { id: businessId } });
    if (!userBusiness) {
      return res.status(400).json({ error: "User's business not found." });
    }

    const categoryId = userBusiness.category_id;

    const newTemplate = await messageTemplateService.createTemplate({
      business_id: businessId,
      category_id: categoryId,
      template_name_en,
      template_name_ar,
      message_ar,
      message_en,
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
    const businessId = req.user.business_id;

    const result = await messageTemplateService.getAllTemplates(
      Number(page),
      Number(limit),
      businessId,
      search
    );

    // ⬇️ include global placeholders for UI to display
    const placeholders = await messageTemplateService.getGlobalPlaceholders();
    res.json({ ...result, placeholders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTemplateById = async (req, res) => {
  try {
    const tpl = await messageTemplateService.getTemplateById(req.params.id);
    if (!tpl) return res.status(404).json({ error: "Template not found" });

    // Allow if system template or belongs to same business
    if (tpl.business_id && tpl.business_id !== req.user.business_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(tpl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const tpl = await messageTemplateService.getTemplateById(req.params.id);
    if (!tpl) return res.status(404).json({ error: "Template not found" });

    // Only update business-owned templates of same business
    if (!tpl.business_id || tpl.business_id !== req.user.business_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // ensure placeholders (if accidentally sent by old clients) are ignored
    const { placeholders, ...safeBody } = req.body || {};

    const updated = await messageTemplateService.updateTemplate(
      req.params.id,
      safeBody
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const tpl = await messageTemplateService.getTemplateById(req.params.id);
    if (!tpl) return res.status(404).json({ error: "Template not found" });

    if (!tpl.business_id || tpl.business_id !== req.user.business_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await messageTemplateService.deleteTemplate(req.params.id);
    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTemplateCategories = async (_req, res) => {
  try {
    const categories = await messageTemplateService.getTemplateCategories();
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ⬇️ NEW: expose the global placeholders directly
exports.getGlobalPlaceholders = async (_req, res) => {
  try {
    const placeholders = await messageTemplateService.getGlobalPlaceholders();
    res.json({ placeholders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
