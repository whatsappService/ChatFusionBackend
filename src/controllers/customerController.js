const customerService = require("../services/customerService");
const customerExcelTemplateUtil = require("../utils/excelTemplateUtil");
const customerCategoryService = require("../services/customerCategoryService");

exports.addCustomer = async (req, res) => {
  try {
    console.log("addCustomer req.body", req.body);
    
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
      alphabet="",
    } = req.query;
    console.log("getAllCustomers req.query", req.query);
    
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
    
    // Return simplified response with just phone numbers and names
    res.json({
      success: true,
      message: "WhatsApp contacts synced successfully",
      summary: {
        total: result.summary.total,
        added: result.summary.added,
        skipped: result.summary.skipped,
        errors: result.summary.errors
      },
      // Include the Excel report for download if needed
      reportBuffer: result.reportBuffer.toString("base64"),
      note: "These are your WhatsApp contacts from the connected account"
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

/**
 * Download WhatsApp sync report as Excel file.
 * This endpoint performs the sync operation and returns the report as a downloadable Excel file.
 */
exports.downloadSyncReport = async (req, res) => {
  try {
    const language = req.query.lang || "en";
    const format = req.query.format || "excel";
    
    console.log("downloadSyncReport called for user:", req.user.id);
    
    // Perform the sync operation
    const result = await customerService.syncWithWhatsApp(req.user.id);
    
    if (format === "csv") {
      // Set headers for CSV download
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="whatsapp_sync_report.csv"'
      );
      res.setHeader("Content-Type", "text/csv");
      
      // Convert Excel buffer to CSV (simplified - in real implementation, you'd use a proper CSV converter)
      const csvContent = "Phone Number,Name,Status\n";
      res.send(csvContent + "CSV format not fully implemented - use Excel format");
    } else {
      // Set headers for Excel download
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="whatsapp_sync_report.xlsx"'
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      
      // Send the Excel report buffer
      res.send(result.reportBuffer);
    }
  } catch (error) {
    console.error("Error downloading sync report:", error);
    res.status(500).json({ error: error.message });
  }
};
