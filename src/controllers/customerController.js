const customerService = require("../services/customerService");

// controllers/customerController.js
exports.addCustomer = async (req, res) => {
  try {
    // Merge authenticated user's id into the customer data
    const customerData = {
      ...req.body,
      user_id: req.user.id, // Set user_id from authenticated user
    };

    // Validate required fields
    if (!customerData.whatsapp_number) {
      return res.status(400).json({ error: "whatsapp_number is required" });
    }
    if (!customerData.gender) {
      return res.status(400).json({ error: "gender is required" });
    }

    const customer = await customerService.addCustomer(customerData);
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const { page = 0, limit = 10, category_id, search = "" } = req.query;
    const result = await customerService.getAllCustomers(
      Number(page),
      Number(limit),
      category_id,
      search
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const updatedCustomer = await customerService.updateCustomer(
      req.params.id,
      req.body
    );
    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    await customerService.deleteCustomer(req.params.id);
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
