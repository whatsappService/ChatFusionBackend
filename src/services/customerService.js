const Customer = require('../models/customer');

exports.getAllCustomers = async () => {
    return await Customer.findAll();
};

exports.getCustomerById = async (id) => {
    return await Customer.findByPk(id);
};

exports.addCustomer = async (data) => {
    return await Customer.create(data);
};

exports.updateCustomer = async (id, data) => {
    const customer = await Customer.findByPk(id);
    if (!customer) throw new Error('Customer not found');
    return await customer.update(data);
};

exports.deleteCustomer = async (id) => {
    const customer = await Customer.findByPk(id);
    if (!customer) throw new Error('Customer not found');
    await customer.destroy();
    return { message: 'Customer deleted successfully' };
};