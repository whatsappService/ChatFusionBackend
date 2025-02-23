const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, reportController.getReports);
router.post('/download', authMiddleware, reportController.downloadReport);

module.exports = router;