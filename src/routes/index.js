const express = require("express");

const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const businessRoutes = require("./businessRoutes");
const businessCategoryRoutes = require("./businessCategoryRoutes");
const customerRoutes = require("./customerRoutes");
const customerCategoryRoutes = require("./customerCategoryRoutes");
const messageTemplateRoutes = require("./messageTemplateRoutes");
const historyRoutes = require("./historyRoutes");
const whatsappRoutes = require("./whatsappRoutes");
const messageRoutes = require("./messageRoutes");
const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/businesses", businessRoutes);
router.use("/business-categories", businessCategoryRoutes);
router.use("/customers", customerRoutes);
router.use("/customer-categories", customerCategoryRoutes);
router.use("/message-templates", messageTemplateRoutes);
router.use("/history", historyRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/messaging", messageRoutes);

module.exports = router;
