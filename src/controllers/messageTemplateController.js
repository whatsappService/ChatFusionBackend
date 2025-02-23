const MessageTemplate = require('../models/messageTemplate');

exports.createTemplate = async (req, res) => {
    try {
        const template = await MessageTemplate.create(req.body);
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllTemplates = async (req, res) => {
    try {
        const templates = await MessageTemplate.findAll();
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTemplateById = async (req, res) => {
    try {
        const template = await MessageTemplate.findByPk(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const template = await MessageTemplate.findByPk(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        await template.update(req.body);
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const template = await MessageTemplate.findByPk(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        await template.destroy();
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};