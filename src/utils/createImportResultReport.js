const ExcelJS = require("exceljs");

// Translation strings for the status messages in English and Arabic.
const translations = {
  en: {
    missingPhone: "Phone number is missing",
    notRegistered: "Not registered on WhatsApp",
    alreadyExists: "Already exists",
    addedSuccessfully: "Added successfully",
    error: "Error: ",
  },
  ar: {
    missingPhone: "رقم الهاتف مفقود",
    notRegistered: "غير مسجل على واتساب",
    alreadyExists: "موجود بالفعل",
    addedSuccessfully: "تمت الإضافة بنجاح",
    error: "خطأ: ",
  },
};

/**
 * Create an Excel report for the import result.
 *
 * @param {Array<Array>} rows - Array of rows (each row is an array of cell values). The last column in each row should be a status code.
 * @param {string} language - Language code ("en" or "ar"). Defaults to "en".
 * @returns {Promise<Buffer>} - A promise that resolves to the Excel file buffer.
 */
async function createImportResultReport(rows, language = "en") {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Import Results");

  // Process each data row (assuming the first row is the header)
  // For every row after the header, translate the status code.
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    let statusKey = row[row.length - 1];
    if (typeof statusKey === "string") {
      // If the status key is defined in our translations, use it.
      if (translations[language][statusKey]) {
        row[row.length - 1] = translations[language][statusKey];
      } else if (statusKey.toLowerCase().startsWith("error:")) {
        // If the status starts with "error:", prepend the translation for error.
        row[row.length - 1] =
          translations[language].error + statusKey.substring(6).trim();
      }
    }
  }

  // Write all rows to the worksheet
  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  // Return the Excel file as a Buffer.
  return workbook.xlsx.writeBuffer();
}

module.exports = {
  createImportResultReport,
};
