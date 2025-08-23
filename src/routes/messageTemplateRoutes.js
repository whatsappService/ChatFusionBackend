const express = require("express");
const router = express.Router();
const messageTemplateController = require("../controllers/messageTemplateController");
const authMiddleware = require("../middleware/authMiddleware");
// ✅ Add this route to fetch message template categories
router.get("/categories", messageTemplateController.getTemplateCategories);
router.post("/", authMiddleware, messageTemplateController.createTemplate);
router.get("/", authMiddleware, messageTemplateController.getAllTemplates);
router.get("/:id", messageTemplateController.getTemplateById);
router.put("/:id", messageTemplateController.updateTemplate);
router.delete("/:id", messageTemplateController.deleteTemplate);

module.exports = router;
