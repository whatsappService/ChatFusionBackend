// src/utils/excelTemplateUtil.js
const ExcelJS = require("exceljs");

// Translation maps for template text in English and Arabic.
const translations = {
  en: {
    headerCustomerName: "Customer Name",
    headerPhoneNumber: "Phone Number",
    headerGender: "Gender",
    headerCategory: "Category",
    instruction:
      "Please fill in the customer details. Phone numbers must start with the country code (without a '+').",
    genderOptions: ["male", "female", "not_set"],
  },
  ar: {
    headerCustomerName: "اسم العميل",
    headerPhoneNumber: "رقم الهاتف",
    headerGender: "الجنس",
    headerCategory: "الفئة",
    instruction:
      "يرجى ملء تفاصيل العميل. يجب أن يبدأ رقم الهاتف برمز الدولة (بدون علامة +).",
    genderOptions: ["ذكر", "أنثى", "غير محدد"],
  },
};

/**
 * Create an Excel template for importing customers.
 *
 * The template includes the following columns:
 *   - Customer Name
 *   - Phone Number
 *   - Gender (dropdown list)
 *   - Category (dropdown list)
 *
 * The phone numbers should be entered as strings starting with the country code (without a '+').
 * Data validation is added for the Gender and Category columns.
 *
 * @param {number} userId - The authenticated user's ID (not used directly here).
 * @param {string} language - "en" or "ar" (defaults to "en").
 * @param {Array<string>} categoryNames - Array of category names available to the user.
 * @returns {Promise<Buffer>} - A promise that resolves to an Excel file buffer.
 */
const createCustomerImportTemplate = async (
  userId,
  language = "en",
  categoryNames = []
) => {
  const t = translations[language] || translations.en;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Customer Import Template");

  // Create header row.
  const headerRow = [
    t.headerCustomerName,
    t.headerPhoneNumber,
    t.headerGender,
    t.headerCategory,
  ];
  worksheet.addRow(headerRow);

  // Add an instructions row (e.g., row 2).
  const instructionRow = worksheet.addRow([t.instruction]);
  instructionRow.font = { italic: true, color: { argb: "FF555555" } };

  // (Optional) Leave an empty row (row 3) to separate headers from data.
  worksheet.addRow([]);

  // Set data validation for the Gender column (Column C) for rows 4 to 100.
  const maxRows = 100;
  for (let rowNum = 4; rowNum <= maxRows; rowNum++) {
    worksheet.getCell(`C${rowNum}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${t.genderOptions.join(",")}"`],
      showErrorMessage: true,
      errorTitle: t.headerGender,
      error: "Please select a valid option.",
    };
  }

  // Set data validation for the Category column (Column D) for rows 4 to 100 if categoryNames exist.
  if (categoryNames.length > 0) {
    const categoryList = categoryNames.join(",");
    for (let rowNum = 4; rowNum <= maxRows; rowNum++) {
      worksheet.getCell(`D${rowNum}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`"${categoryList}"`],
        showErrorMessage: true,
        errorTitle: t.headerCategory,
        error: "Please select a valid category.",
      };
    }
  }

  // Auto-adjust column widths based on content.
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : "";
      if (cellValue.length > maxLength) {
        maxLength = cellValue.length;
      }
    });
    column.width = maxLength + 2;
  });

  // Return the workbook as a Buffer.
  return workbook.xlsx.writeBuffer();
};

module.exports = { createCustomerImportTemplate };
