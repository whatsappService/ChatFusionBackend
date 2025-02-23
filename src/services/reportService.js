const Report = require('../models/report');

exports.getAllReports = async () => {
    return await Report.findAll();
};

exports.getReportById = async (id) => {
    return await Report.findByPk(id);
};

exports.createReport = async (data) => {
    return await Report.create(data);
};

exports.downloadReport = async (id) => {
    const report = await Report.findByPk(id);
    if (!report) throw new Error('Report not found');
    return report;
};