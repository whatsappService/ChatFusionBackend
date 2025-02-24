const express = require("express");

const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const businessRoutes = require("./businessRoutes");
const businessCategoryRoutes = require("./businessCategoryRoutes");
const customerRoutes = require("./customerRoutes");
const customerCategoryRoutes = require("./customerCategoryRoutes");
const messageTemplateRoutes = require("./messageTemplateRoutes");
const reportRoutes = require("./reportRoutes");
const whatsappRoutes = require("./whatsappRoutes");
const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/businesses", businessRoutes);
router.use("/business-categories", businessCategoryRoutes);
router.use("/customers", customerRoutes);
router.use("/customer-categories", customerCategoryRoutes);
router.use("/message-templates", messageTemplateRoutes);
router.use("/reports", reportRoutes);
router.use("/whatsapp", whatsappRoutes);

module.exports = router;
