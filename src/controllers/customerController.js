const customerService = require("../services/customerService");
const customerExcelTemplateUtil = require("../utils/excelTemplateUtil");
const customerCategoryService = require("../services/customerCategoryService");

exports.addCustomer = async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      user_id: req.user.id,
    };

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
    const {
      page = 0,
      limit = 10,
      category_id,
      search = "",
      order = "asc",
      alphabet,
    } = req.query;
    const result = await customerService.getAllCustomers(
      Number(page),
      Number(limit),
      category_id,
      search,
      order,
      alphabet
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
exports.getCustomersByUserId = async (req, res) => {
  try {
    const customer = await customerService.getCustomersByUserId(req.params.id);
    if (!customer)
      return res.status(404).json({ error: "Customers not found" });
    res.json(customer);
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

/**
 * Import customers from an uploaded Excel file.
 */
exports.importCustomers = async (req, res) => {
  try {
    const filePath = req.file.path;
    const language = req.query.lang || "en";

    const reportBuffer = await customerService.importCustomersFromExcel(
      filePath,
      req.user.id,
      language
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="import_report.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(reportBuffer);
  } catch (error) {
    console.error("Error importing customers:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Sync customers with WhatsApp.
 */

/**
 * Sync customers with WhatsApp.
 * This endpoint calls the syncWithWhatsApp service, which returns an Excel report (reportBuffer)
 * and a summary of contacts processed.
 */
exports.syncWithWhatsApp = async (req, res) => {
  try {
    console.log("syncWithWhatsApp called for user:", req.user.id);
    const result = await customerService.syncWithWhatsApp(req.user.id);
    // Return the result as JSON. The reportBuffer is sent as a base64 string.
    res.json({
      success: true,
      data: {
        // Convert the buffer to base64 so it can be handled on the client side.
        reportBuffer: result.reportBuffer.toString("base64"),
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error("Error syncing with WhatsApp:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Download an Excel import template for customers.
 * This template includes:
 * - Customer Name
 * - Phone Number (start with country code without '+')
 * - Gender (with options "male", "female", "notSet")
 * - Category (options from the authenticated user's categories)
 *
 * Query param "lang" can be used for translations ("en" or "ar").
 */
exports.downloadImportTemplate = async (req, res) => {
  try {
    const language = req.query.lang || "en";
    console.log(req.user);

    // Get categories for the authenticated user
    const categories = await customerCategoryService.getAllCategoriesByUser(
      req.user.id
    );
    // Extract category names from the categories
    const categoryNames = categories.map((cat) => cat.name);

    // Create the Excel template using the utility
    const buffer = await customerExcelTemplateUtil.createCustomerImportTemplate(
      req.user.id,
      language,
      categoryNames
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="customer_import_template.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating import template:", error);
    res.status(500).json({ error: error.message });
  }
};
