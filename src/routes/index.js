"use strict";

const express = require("express");

// Core
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const businessRoutes = require("./businessRoutes");
const businessCategoryRoutes = require("./businessCategoryRoutes");

// Customers
const customerRoutes = require("./customerRoutes");
const customerCategoryRoutes = require("./customerCategoryRoutes");

// Messaging
const messageTemplateRoutes = require("./messageTemplateRoutes");
const messageRoutes = require("./messageRoutes");
const scheduleRoutes = require("./scheduleRoutes");

// Integrations / Ops
const whatsappRoutes = require("./whatsappRoutes");
const webhookRoutes = require("./webhookRoutes");
const apiAccessRoutes = require("./apiAccessRoutes");

// Insights / Team / Bot
const analyticsRoutes = require("./analyticsRoutes");
const multiUserRoutes = require("./multiUserRoutes");
const chatbotRoutes = require("./chatbotRoutes");

// History / Reports
const historyRoutes = require("./historyRoutes");

const router = express.Router();

// Auth
router.use("/auth", authRoutes);

// Core entities
router.use("/users", userRoutes);
router.use("/businesses", businessRoutes);
router.use("/business-categories", businessCategoryRoutes);

// Customers
router.use("/customers", customerRoutes);
router.use("/customer-categories", customerCategoryRoutes);

// Messaging
router.use("/message-templates", messageTemplateRoutes);
router.use("/messages", messageRoutes);
router.use("/schedules", scheduleRoutes);

// Integrations / Ops
router.use("/whatsapp", whatsappRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/api-access", apiAccessRoutes);

// Insights / Team / Bot
router.use("/analytics", analyticsRoutes);
router.use("/multi-user", multiUserRoutes);
router.use("/chatbot", chatbotRoutes);

// History / Reports
router.use("/history", historyRoutes);

module.exports = router;
