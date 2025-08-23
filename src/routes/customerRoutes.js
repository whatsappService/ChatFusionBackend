const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, customerController.addCustomer);
router.get("/", customerController.getAllCustomers); // ✅ Now supports pagination & category filter
router.get("/:id", customerController.getCustomerById);
router.put("/:id", customerController.updateCustomer);
router.delete("/:id", customerController.deleteCustomer);

module.exports = router;
