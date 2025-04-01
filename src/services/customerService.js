const { Op } = require("sequelize");
const Customer = require("../models/customer");
const CustomerCategory = require("../models/customerCategory");
const ExcelJS = require("exceljs");
const whatsappService = require("../services/whatsappService");
const {
  createImportResultReport,
} = require("../utils/createImportResultReport");

// Define a default category ID (adjust as needed)
const DEFAULT_CATEGORY_ID = 1;

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
    whereCondition.profile_name = { [Op.like]: `%${searchTerm}%` };
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
    console.log("addCustomer data", data);
    return await Customer.create(data);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw new Error("This phone number is already added");
    }
    throw error;
  }
};

exports.updateCustomer = async (id, data) => {
  const customer = await Customer.findByPk(id);
  if (!customer) throw new Error("Customer not found");

  const updateData = {
    profile_name: data.profileName,
    whatsapp_number: data.whatsapp_number || data.whatsappNumber,
    category_id: data.categoryId,
    gender: data.gender,
  };

  return await customer.update(updateData);
};

exports.getCustomersByUserId = async (userId) => {
  return await Customer.findAll({ where: { user_id: userId } });
};

exports.deleteCustomer = async (id) => {
  const customer = await Customer.findByPk(id);
  if (!customer) throw new Error("Customer not found");
  await customer.destroy();
  return { message: "Customer deleted successfully" };
};

/**
 * Import customers from an uploaded Excel file.
 *
 * The Excel file should have a header row with the columns:
 *   [Customer Name, Phone Number, Gender, Category]
 *
 * For each data row:
 * - If the phone number is missing, mark status as "missingPhone".
 * - Otherwise, validate the phone number via WhatsApp API.
 *   - If not registered, mark status as "notRegistered".
 *   - If already exists in the database, mark status as "alreadyExists".
 *   - Otherwise, create the customer with:
 *       • whatsapp_number: from the Excel file (converted to string)
 *       • profile_name: from the WhatsApp API response’s pushname (or fallback to the Excel “Customer Name”)
 *       • gender: from the Excel file, normalized to "male", "female", or "not_set" (default "not_set")
 *       • category_id: determined by matching the Excel category (if provided) with the user's categories;
 *         if not provided or not found, use a default category.
 * - Append the status to the row and later generate a report using the utility.
 *
 * @param {string} filePath - Path to the uploaded Excel file.
 * @param {number} userId - The authenticated user's ID.
 * @param {string} language - Language for status messages ("en" or "ar").
 * @returns {Promise<Buffer>} - A buffer containing the generated Excel report.
 */
exports.importCustomersFromExcel = async (
  filePath,
  userId,
  language = "en"
) => {
  // Load the input workbook from the provided file path.
  const inputWorkbook = new ExcelJS.Workbook();
  await inputWorkbook.xlsx.readFile(filePath);
  const worksheet = inputWorkbook.getWorksheet(1); // Use the first worksheet
  console.log("importCustomersFromExcel");

  // Get header row (assuming first row is header) and add a "Status" column.
  const headerRow = worksheet.getRow(1).values.slice(1); // Remove the first undefined element
  headerRow.push("Status");
  const reportRows = [headerRow];
  console.log("Header row:", reportRows);
  console.log("Total rows:", worksheet.rowCount);

  // Loop through each data row (starting at row 2)
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const rowValues = row.values.slice(1); // Expected: [Customer Name, Phone Number, Gender, Category]
    const [excelName, phone, gender, category] = rowValues;
    let statusKey = "";
    console.log("Processing row:", rowValues);

    // Ensure the phone is a string.
    const phoneStr = phone ? String(phone) : "";

    if (!phoneStr) {
      statusKey = "missingPhone";
    } else {
      try {
        console.log("Validating phone for user:", userId, phoneStr);
        const validationResponse = await whatsappService.checkWhatsAppNumber(
          userId,
          phoneStr
        );
        console.log("Validation response:", validationResponse);

        if (!validationResponse.registered) {
          statusKey = "notRegistered";
        } else {
          // Check if the customer already exists.
          const existing = await Customer.findOne({
            where: { whatsapp_number: phoneStr },
          });
          if (existing) {
            statusKey = "alreadyExists";
          } else {
            // Use pushname from WhatsApp response if available; otherwise fallback to the Excel "Customer Name".
            const pushname =
              validationResponse.contact.pushname || excelName || "";
            // Determine category_id:
            let categoryValue = DEFAULT_CATEGORY_ID;
            console.log("Category provided:", category);
            console.log("userId:", userId);

            if (category) {
              const catObj = await CustomerCategory.findOne({
                where: {
                  user_id: userId,
                  // Use Op.like for case-insensitive matching in MySQL.
                  name: { [Op.like]: category },
                },
              });
              console.log("Found category object:", catObj);
              if (catObj) {
                categoryValue = catObj.id;
              }
            }

            // Normalize gender: if gender is provided, convert to lower case and if it equals "notset", change to "not_set"
            const normalizedGender =
              gender && gender.toLowerCase() === "notset"
                ? "not_set"
                : gender
                ? gender.toLowerCase()
                : "not_set";

            const newCustomerData = {
              user_id: userId,
              whatsapp_number: phoneStr,
              profile_name: pushname,
              gender: normalizedGender,
              category_id: categoryValue,
              status: "verified",
            };
            console.log("Creating new customer with data:", newCustomerData);
            // Capture the addCustomer function locally so we can call it.
            const addCustomerFn = exports.addCustomer;
            const newCustomer = await addCustomerFn(newCustomerData);
            console.log("New customer created:", newCustomer);
            statusKey = newCustomer
              ? "addedSuccessfully"
              : "error: Failed to add";
          }
        }
      } catch (error) {
        statusKey = "error: " + error.message;
      }
    }

    // Append the row data along with the status.
    reportRows.push([...rowValues, statusKey]);
  }

  // Create the report Excel file using the utility (this utility will translate status messages).
  const reportBuffer = await createImportResultReport(reportRows, language);
  return reportBuffer;
};

module.exports = {
  getAllCustomers: exports.getAllCustomers,
  getCustomerById: exports.getCustomerById,
  addCustomer: exports.addCustomer,
  updateCustomer: exports.updateCustomer,
  getCustomersByUserId: exports.getCustomersByUserId,
  deleteCustomer: exports.deleteCustomer,
  importCustomersFromExcel: exports.importCustomersFromExcel,
};
