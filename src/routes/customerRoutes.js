const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
// New route: Download import template
router.get(
    "/import-template",
    authMiddleware,
    customerController.downloadImportTemplate
  );
// Existing customer routes
router.post("/", authMiddleware, customerController.addCustomer);
router.get("/", customerController.getAllCustomers); // supports pagination & category filter
router.get("/:id", customerController.getCustomerById);
router.put("/:id", customerController.updateCustomer);
router.delete("/:id", customerController.deleteCustomer);

// New route for importing customers from Excel
router.post(
  "/import",
  authMiddleware,
  upload.single("file"),
  customerController.importCustomers
);

// New route for syncing with WhatsApp
router.post(
  "/sync-whatsapp",
  authMiddleware,
  customerController.syncWithWhatsApp
);



module.exports = router;
