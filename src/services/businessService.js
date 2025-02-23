const Business = require('../models/business');

exports.getAllBusinesses = async () => {
    return await Business.findAll();
};

exports.getBusinessById = async (id) => {
    return await Business.findByPk(id);
};

exports.createBusiness = async (data) => {
    return await Business.create(data);
};

exports.updateBusiness = async (id, data) => {
    const business = await Business.findByPk(id);
    if (!business) throw new Error('Business not found');
    return await business.update(data);
};

exports.deleteBusiness = async (id) => {
    const business = await Business.findByPk(id);
    if (!business) throw new Error('Business not found');
    await business.destroy();
    return { message: 'Business deleted successfully' };
};