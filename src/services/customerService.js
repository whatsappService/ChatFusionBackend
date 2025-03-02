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
  try {
    return await Customer.create(data);
  } catch (error) {
    // Check if the error is a Sequelize unique constraint error
    if (error.name === "SequelizeUniqueConstraintError") {
      throw new Error("This phone number is already added");
    }
    throw error;
  }
};

exports.updateCustomer = async (id, data) => {
  const customer = await Customer.findByPk(id);
  if (!customer) throw new Error("Customer not found");

  // Map incoming camelCase fields to snake_case as defined in your model.
  const updateData = {
    profile_name: data.profileName,
    whatsapp_number: data.whatsapp_number || data.whatsappNumber,
    category_id: data.categoryId,
    gender: data.gender,
    // include any other fields as needed
  };

  return await customer.update(updateData);
};

exports.deleteCustomer = async (id) => {
  const customer = await Customer.findByPk(id);
  if (!customer) throw new Error("Customer not found");
  await customer.destroy();
  return { message: "Customer deleted successfully" };
};
