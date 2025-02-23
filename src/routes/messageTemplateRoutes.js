const express = require('express');
const router = express.Router();
const messageTemplateController = require('../controllers/messageTemplateController');

router.post('/', messageTemplateController.createTemplate);
router.get('/', messageTemplateController.getAllTemplates);
router.get('/:id', messageTemplateController.getTemplateById);
router.put('/:id', messageTemplateController.updateTemplate);
router.delete('/:id', messageTemplateController.deleteTemplate);

module.exports = router;