// src/utils/excelGenerator.js
const ExcelJS = require("exceljs");

/**
 * Generate an Excel report from a given report object.
 *
 * The report object should have the following structure:
 * {
 *   id: string,
 *   userId: string,
 *   messageType: string, // either "single" or "bulk"
 *   timestamp: string,   // ISO timestamp for the report creation
 *   messages: [
 *     {
 *       id: string,         // not used in the Excel file
 *       recipient: string,
 *       status: string,
 *       content: string,
 *       timestamp: string  // will be formatted as date and time
 *     },
 *     ...
 *   ]
 * }
 *
 * @param {Object} report - The report data.
 * @returns {Promise<Buffer>} A promise that resolves to the Excel file as a buffer.
 */
async function generateExcelReport(report) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("History Report");

  // Set the page setup to match A4 paper size in portrait mode with custom margins.
  worksheet.pageSetup = {
    paperSize: 9, // 9 represents A4 in Excel
    orientation: "portrait",
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    },
  };

  // Title Row: "Messages Report" (merged across columns A to D)
  worksheet.mergeCells("A1:D1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "Messages Report";
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "center" };

  // Second Row: Report details (Message Type and Report Timestamp)
  worksheet.getCell("A2").value = "Message Type:";
  worksheet.getCell("B2").value = report.messageType;
  worksheet.getCell("C2").value = "Report Timestamp:";
  // Format the report timestamp as a local date and time string
  const reportDate = new Date(report.timestamp);
  worksheet.getCell("D2").value = reportDate.toLocaleString();

  // Add header for messages starting at row 4
  const headerRowIndex = 4;
  const headers = ["Recipient", "Status", "Content", "Timestamp"];
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = headers;
  headerRow.font = { bold: true };

  // Add each message starting from row 5 (skip the message id)
  report.messages.forEach((msg, index) => {
    const rowIndex = headerRowIndex + 1 + index;
    const msgDate = new Date(msg.timestamp);
    const row = worksheet.getRow(rowIndex);
    row.values = [
      msg.recipient,
      msg.status,
      msg.content,
      msgDate.toLocaleString(),
    ];
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = generateExcelReport;
