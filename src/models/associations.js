// src/models/associations.js
"use strict";

// Core models
const User = require("./user");
const Business = require("./business");
const BusinessCategory = require("./businessCategory");

// Messaging + catalog
const Customer = require("./customer");
const CustomerCategory = require("./customerCategory");
const MessageTemplate = require("./messageTemplate");
const Report = require("./report");

// Feature flags
const Feature = require("./feature");
const BusinessFeature = require("./businessFeature");
const UserFeature = require("./userFeature");

// Scheduling
const ScheduledMessage = require("./scheduledMessage");

/* =========================
 * Core relationships
 * =======================*/

// Business ↔ BusinessCategory
Business.belongsTo(BusinessCategory, {
  foreignKey: "category_id",
  as: "category",
});
BusinessCategory.hasMany(Business, {
  foreignKey: "category_id",
  as: "businesses",
});

// User ↔ Business
User.belongsTo(Business, { foreignKey: "business_id", as: "business" });
Business.hasMany(User, { foreignKey: "business_id", as: "users" });

/* =========================
 * Feature flags
 * =======================*/

// Business-level toggles
BusinessFeature.belongsTo(Business, {
  foreignKey: "business_id",
  as: "business",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
BusinessFeature.belongsTo(Feature, {
  foreignKey: "feature_id",
  as: "feature",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Business.hasMany(BusinessFeature, {
  foreignKey: "business_id",
  as: "featureToggles",
});

// Many-to-many: Business ↔ Feature
Business.belongsToMany(Feature, {
  through: BusinessFeature,
  foreignKey: "business_id",
  otherKey: "feature_id",
  as: "features",
});
Feature.belongsToMany(Business, {
  through: BusinessFeature,
  foreignKey: "feature_id",
  otherKey: "business_id",
  as: "businesses",
});

// User-level overrides
UserFeature.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
UserFeature.belongsTo(Feature, {
  foreignKey: "feature_id",
  as: "feature",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
User.hasMany(UserFeature, {
  foreignKey: "user_id",
  as: "featureOverrides",
});

// Optional many-to-many: User ↔ Feature via UserFeature
User.belongsToMany(Feature, {
  through: UserFeature,
  foreignKey: "user_id",
  otherKey: "feature_id",
  as: "features",
});
Feature.belongsToMany(User, {
  through: UserFeature,
  foreignKey: "feature_id",
  otherKey: "user_id",
  as: "users",
});

/* =========================
 * Scheduling
 * =======================*/
ScheduledMessage.belongsTo(Business, {
  foreignKey: "business_id",
  as: "business",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
ScheduledMessage.belongsTo(User, {
  foreignKey: "created_by_user",
  as: "creator",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Business.hasMany(ScheduledMessage, {
  foreignKey: "business_id",
  as: "scheduledMessages",
});
User.hasMany(ScheduledMessage, {
  foreignKey: "created_by_user",
  as: "createdSchedules",
});

/* =========================
 * Customers & templates
 * =======================*/

// CustomerCategory ↔ User (owner)
CustomerCategory.belongsTo(User, { foreignKey: "user_id", as: "owner" });
User.hasMany(CustomerCategory, {
  foreignKey: "user_id",
  as: "customerCategories",
});

// Customer ↔ User & Category
Customer.belongsTo(User, { foreignKey: "user_id", as: "owner" });
Customer.belongsTo(CustomerCategory, {
  foreignKey: "category_id",
  as: "customerCategory",
});
User.hasMany(Customer, { foreignKey: "user_id", as: "customers" });
CustomerCategory.hasMany(Customer, {
  foreignKey: "category_id",
  as: "customers",
});

// MessageTemplate ↔ User(owner) & BusinessCategory
MessageTemplate.belongsTo(User, { foreignKey: "user_id", as: "owner" });
MessageTemplate.belongsTo(BusinessCategory, {
  foreignKey: "category_id",
  as: "businessCategory",
});
User.hasMany(MessageTemplate, { foreignKey: "user_id", as: "templates" });
BusinessCategory.hasMany(MessageTemplate, {
  foreignKey: "category_id",
  as: "templates",
});

// Report ↔ User(owner)
Report.belongsTo(User, { foreignKey: "user_id", as: "owner" });
User.hasMany(Report, { foreignKey: "user_id", as: "reports" });

/* =========================
 * Initialize scopes after wiring
 * =======================*/
if (typeof Business.initScopes === "function") Business.initScopes();
if (typeof User.initScopes === "function") User.initScopes();

module.exports = {
  User,
  Business,
  BusinessCategory,
  Customer,
  CustomerCategory,
  MessageTemplate,
  Report,
  Feature,
  BusinessFeature,
  UserFeature,
  ScheduledMessage,
};

/* =========================
 * END
 * =======================*/