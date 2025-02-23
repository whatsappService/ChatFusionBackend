const MessageTemplate = require('../models/messageTemplate');

exports.getAllTemplates = async () => {
    return await MessageTemplate.findAll();
};

exports.getTemplateById = async (id) => {
    return await MessageTemplate.findByPk(id);
};

exports.createTemplate = async (data) => {
    return await MessageTemplate.create(data);
};

exports.updateTemplate = async (id, data) => {
    const template = await MessageTemplate.findByPk(id);
    if (!template) throw new Error('Template not found');
    return await template.update(data);
};

exports.deleteTemplate = async (id) => {
    const template = await MessageTemplate.findByPk(id);
    if (!template) throw new Error('Template not found');
    await template.destroy();
    return { message: 'Template deleted successfully' };
};