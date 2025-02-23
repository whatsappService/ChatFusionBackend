const reportService = require('../services/reportService');

exports.getReports = async (req, res) => {
    try {
        const reports = await reportService.getAllReports();
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.downloadReport = async (req, res) => {
    try {
        const report = await reportService.downloadReport(req.body.id);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};