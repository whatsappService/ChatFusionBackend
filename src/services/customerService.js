const { Op } = require("sequelize");
const Customer = require("../models/customer");

exports.getAllCustomers = async (
  page = 0,
  limit = 10,
  categoryId = null,
  searchTerm = ""
) => {
  const offset = page * limit;

  const whereCondition = {};

  if (categoryId) {
    whereCondition.category_id = categoryId;
  }

  if (searchTerm) {
    whereCondition.profile_name = {
      [Op.like]: `%${searchTerm}%`, // ✅ Case-insensitive search by customer name
    };
  }

  const { rows: customers, count } = await Customer.findAndCountAll({
    where: whereCondition,
    offset,
    limit,
  });

  return { customers, total: count, page, limit };
};

exports.getCustomerById = async (id) => {
  return await Customer.findByPk(id);
};

exports.addCustomer = async (data) => {
  return await Customer.create(data);
};

exports.updateCustomer = async (id, data) => {
  const customer = await Customer.findByPk(id);
  if (!customer) throw new Error("Customer not found");
  return await customer.update(data);
};

exports.deleteCustomer = async (id) => {
  const customer = await Customer.findByPk(id);
  if (!customer) throw new Error("Customer not found");
  await customer.destroy();
  return { message: "Customer deleted successfully" };
};
