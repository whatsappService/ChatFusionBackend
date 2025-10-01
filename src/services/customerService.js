const { Op } = require("sequelize");
const Customer = require("../models/customer");
const CustomerCategory = require("../models/customerCategory");
const ExcelJS = require("exceljs");
const whatsappService = require("../services/whatsappService");
const {
  createImportResultReport,
} = require("../utils/createImportResultReport");
const Business = require("../models/business");
const { default: axios } = require("axios");
const User = require("../models/user");

// Define a default category ID (adjust as needed)
const DEFAULT_CATEGORY_ID = 1;

exports.getAllCustomers = async (
  page = 0,
  limit = 10,
  categories = [],
  searchTerm = "",
  order = "asc",
  alphabet = ""
) => {
  const offset = page * limit;
  const whereCondition = {};

  // Category filtering
  if (categories.length > 0 && !categories.includes("All")) {
    whereCondition.category_id = { [Op.in]: categories };
  }

  // Alphabet filtering
  if (alphabet && alphabet !== "All") {
    const conditions = [];

    if (alphabet === "#") {
      conditions.push({
        profile_name: { [Op.regexp]: "^[^A-Za-zأ-ي]" },
      });
    } else {
      // const arEquivalent = EN_AR_LETTER_MAP[alphabet.toUpperCase()];
      const arEquivalent =
        (typeof EN_AR_LETTER_MAP !== "undefined" &&
          EN_AR_LETTER_MAP[alphabet.toUpperCase()]) ||
        alphabet.toUpperCase();
      conditions.push(
        { profile_name: { [Op.like]: `${arEquivalent}%` } },
        { profile_name: { [Op.like]: `${alphabet.toUpperCase()}%` } },
        { profile_name: { [Op.like]: `${alphabet.toLowerCase()}%` } }
      );
    }

    whereCondition[Op.or] = conditions;
  }

  // Search term handling
  if (searchTerm) {
    whereCondition[Op.or] = [
      { profile_name: { [Op.like]: `%${searchTerm}%` } },
      { whatsapp_number: { [Op.like]: `%${searchTerm}%` } },
    ];
  }

  const { rows: customers, count } = await Customer.findAndCountAll({
    where: whereCondition,
    offset,
    limit,
    order: [["profile_name", order]],
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
            const normalizedGender = (() => {
              const g = (gender || "").toString().trim().toLowerCase();
              if (!g) return "not_set";
              if (g === "notset" || g === "not_set" || g === "unspecified")
                return "not_set";
              return g === "male" || g === "female" ? g : "not_set";
            })();

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
/**
 * Sync customers with WhatsApp.
 *
 * This service calls the ChatFusion WhatsApp contacts endpoint, then iterates over
 * each contact. For each contact, if a customer with the contact's phone number does not already exist,
 * it creates a new customer using the contact's pushname (or name) and number.
 *
 * @param {number} userId - The authenticated user's ID.
 * @returns {Promise<Object>} - An object containing a summary: total contacts processed, added, skipped, and errors.
 */
exports.syncWithWhatsApp = async (userId) => {
  // Retrieve the business record to get the API key
  const user = await User.findOne({ where: { id: userId } });
  if (!user || !user.business_id) {
    throw new Error("business id not found for this business.");
  }
  const business = await Business.findOne({ where: { id: user.business_id } });
  if (!business || !business.api_key) {
    throw new Error("API key not found for this business.");
  }
  const CHATFUSION_BASE_URL = process.env.CHATFUSION_BASE_URL || "http://localhost:5500/api";
  const CHATFUSION_CONTACT_URL = process.env.CHATFUSION_WHATSAPP_CONTACT_URL || `${CHATFUSION_BASE_URL}/whatsapp/contact`;
  let response;
  try {
    response = await axios.get(CHATFUSION_CONTACT_URL, {
      headers: { "x-api-key": business.api_key },
    });
  } catch (error) {
    console.error(
      "❌ Error fetching WhatsApp contacts from ChatFusion API:",
      error.response?.data || error.message
    );
    
    if (error.response?.status === 400) {
      // Handle specific 400 errors from WhatsApp service
      const errorData = error.response?.data;
      if (errorData?.message === 'Unable to retrieve WhatsApp contacts' || errorData?.error === 'No contacts available') {
        throw new Error("WhatsApp Contacts Error: No contacts available. Please ensure your WhatsApp account is connected and has contacts.");
      } else {
        throw new Error(`WhatsApp Contacts Error: ${errorData?.message || 'Bad request - Please check your WhatsApp connection'}`);
      }
    } else if (error.response?.status === 401) {
      throw new Error("WhatsApp Contacts Error: Unauthorized - Invalid API key or expired credentials");
    } else if (error.response?.status === 404) {
      throw new Error("WhatsApp Contacts Error: Service not found - ChatFusion API endpoint unavailable");
    } else if (error.response?.status >= 500) {
      throw new Error("WhatsApp Contacts Error: ChatFusion server error - External service is down");
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error("WhatsApp Contacts Error: Cannot connect to ChatFusion API - Network or DNS issue");
    } else {
      throw new Error(`WhatsApp Contacts Error: ${error.message || 'Unknown error occurred'}`);
    }
  }

  // Ensure contacts is an array and extract from nested structure
  let contacts = [];
  console.log("ChatFusion API Response:", JSON.stringify(response.data, null, 2));
  
  if (Array.isArray(response.data)) {
    contacts = response.data;
  } else if (response.data && Array.isArray(response.data.contacts)) {
    contacts = response.data.contacts;
  } else if (response.data && response.data.data && Array.isArray(response.data.data.contacts)) {
    contacts = response.data.data.contacts;
  } else if (response.data && response.data.success && response.data.data && Array.isArray(response.data.data.contacts)) {
    contacts = response.data.data.contacts;
  } else {
    console.error("Unexpected ChatFusion API response format:", response.data);
    throw new Error(`contacts is not iterable. Received: ${JSON.stringify(response.data)}`);
  }

  // Filter contacts based on criteria: isUser=true, isMe=false, isWAContact=true, isBlocked=false
  const filteredContacts = contacts.filter(contact => {
    return contact.isUser === true && 
           contact.isMe === false && 
           contact.isWAContact === true && 
           contact.isBlocked === false;
  });

  let total = filteredContacts.length;
  let added = 0;
  let skipped = 0;
  let errors = 0;

  // Prepare simplified report rows with just phone and name
  const reportRows = [["Phone Number", "Name", "Verified Name"]];

  for (const contact of filteredContacts) {
    try {
      // Extract phone number and names from the contact object
      const phoneStr = contact.number ? String(contact.number) : "";
      const contactName = contact.name || contact.pushname || "";
      const verifiedName = contact.verifiedName || "";
      
      console.log("Processing contact:", { phoneStr, contactName, verifiedName });
      
      if (!phoneStr) {
        skipped++;
        reportRows.push([null, contactName, verifiedName]);
        continue;
      }
      
      // Check if customer already exists
      const existing = await Customer.findOne({
        where: { whatsapp_number: phoneStr },
      });
      if (existing) {
        skipped++;
        reportRows.push([phoneStr, contactName, verifiedName]);
        continue;
      }
      
      // Use verifiedName if available, otherwise fall back to contactName
      const finalName = verifiedName || contactName || "";
      
      const newCustomerData = {
        user_id: userId,
        whatsapp_number: phoneStr,
        profile_name: finalName,
        gender: "not_set",
        category_id: DEFAULT_CATEGORY_ID,
        status: "verified",
      };
      
      await Customer.create(newCustomerData);
      added++;
      reportRows.push([phoneStr, finalName, verifiedName]);
    } catch (error) {
      errors++;
      const phoneStr = contact.number || "unknown";
      const contactName = contact.name || contact.pushname || "unknown";
      const verifiedName = contact.verifiedName || "";
      reportRows.push([phoneStr, contactName, verifiedName]);
      console.error("Error processing contact:", error.message);
    }
  }

  // Generate the Excel report buffer using the utility.
  const reportBuffer = await createImportResultReport(reportRows, "en");
  return { reportBuffer, summary: { total, added, skipped, errors } };
};

module.exports = {
  getAllCustomers: exports.getAllCustomers,
  getCustomerById: exports.getCustomerById,
  addCustomer: exports.addCustomer,
  updateCustomer: exports.updateCustomer,
  getCustomersByUserId: exports.getCustomersByUserId,
  deleteCustomer: exports.deleteCustomer,
  importCustomersFromExcel: exports.importCustomersFromExcel,
  syncWithWhatsApp: exports.syncWithWhatsApp,
};
