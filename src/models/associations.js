"use strict";

/* =========================
 * Require models
 * =======================*/

// Core
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
const UserPermission = require("./userPermission"); // ✅ needed by services

// Scheduling
const ScheduledMessage = require("./scheduledMessage");

// Packages
const BusinessPackage = require("./businessPackage");
const BusinessPackageFeature = require("./businessPackageFeature");
const BusinessPackagePermission = require("./businessPackagePermission");
const BusinessUserPackage = require("./businessUserPackage");

/* =========================
 * Core relationships
 * =======================*/

// Business ↔ BusinessCategory
Business.belongsTo(BusinessCategory, {
  foreignKey: "category_id",
  as: "category",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
BusinessCategory.hasMany(Business, {
  foreignKey: "category_id",
  as: "businesses",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// User ↔ Business (services expect alias 'business')
User.belongsTo(Business, {
  foreignKey: "business_id",
  as: "business",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Business.hasMany(User, {
  foreignKey: "business_id",
  as: "users",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

/* =========================
 * Feature flags & permissions
 * =======================*/

// Business-level feature toggles
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
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Business ↔ Feature (M:N via BusinessFeature)
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

// User-level permission overrides
UserPermission.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
User.hasMany(UserPermission, {
  foreignKey: "user_id",
  as: "permissionOverrides",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// User-level feature overrides
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
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
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
 * Packages
 * =======================*/

// Business ↔ Packages
BusinessPackage.belongsTo(Business, {
  foreignKey: "business_id",
  as: "business",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Business.hasMany(BusinessPackage, {
  foreignKey: "business_id",
  as: "packages",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Package ↔ Feature rules
BusinessPackageFeature.belongsTo(BusinessPackage, {
  foreignKey: "package_id",
  as: "pkg",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
BusinessPackageFeature.belongsTo(Feature, {
  foreignKey: "feature_id",
  as: "feature",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
BusinessPackage.hasMany(BusinessPackageFeature, {
  foreignKey: "package_id",
  as: "featureRules",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
BusinessPackage.belongsToMany(Feature, {
  through: BusinessPackageFeature,
  foreignKey: "package_id",
  otherKey: "feature_id",
  as: "features",
});
Feature.belongsToMany(BusinessPackage, {
  through: BusinessPackageFeature,
  foreignKey: "feature_id",
  otherKey: "package_id",
  as: "packages",
});

// Package ↔ Permissions
BusinessPackagePermission.belongsTo(BusinessPackage, {
  foreignKey: "package_id",
  as: "pkg",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
BusinessPackage.hasMany(BusinessPackagePermission, {
  foreignKey: "package_id",
  as: "permissions",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// User ↔ Packages (assignment junction; no business_id on pivot)
BusinessUserPackage.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
BusinessUserPackage.belongsTo(BusinessPackage, {
  foreignKey: "package_id",
  as: "pkg",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// For fetching junction rows from a package (services expect alias 'assignedUsers')
BusinessPackage.hasMany(BusinessUserPackage, {
  foreignKey: "package_id",
  as: "assignedUsers",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// For fetching real users of a package
BusinessPackage.belongsToMany(User, {
  through: BusinessUserPackage,
  foreignKey: "package_id",
  otherKey: "user_id",
  as: "members",
});

// A user's packages
User.hasMany(BusinessUserPackage, {
  foreignKey: "user_id",
  as: "packageAssignments",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
User.belongsToMany(BusinessPackage, {
  through: BusinessUserPackage,
  foreignKey: "user_id",
  otherKey: "package_id",
  as: "assignedPackages",
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
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
User.hasMany(ScheduledMessage, {
  foreignKey: "created_by_user",
  as: "createdSchedules",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

/* =========================
 * Customers & Templates
 * =======================*/
CustomerCategory.belongsTo(User, {
  foreignKey: "user_id",
  as: "owner",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
User.hasMany(CustomerCategory, {
  foreignKey: "user_id",
  as: "customerCategories",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Customer.belongsTo(User, {
  foreignKey: "user_id",
  as: "owner",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Customer.belongsTo(CustomerCategory, {
  foreignKey: "category_id",
  as: "customerCategory",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
User.hasMany(Customer, {
  foreignKey: "user_id",
  as: "customers",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
CustomerCategory.hasMany(Customer, {
  foreignKey: "category_id",
  as: "customers",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

MessageTemplate.belongsTo(User, {
  foreignKey: "user_id",
  as: "owner",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
MessageTemplate.belongsTo(BusinessCategory, {
  foreignKey: "category_id",
  as: "businessCategory",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
User.hasMany(MessageTemplate, {
  foreignKey: "user_id",
  as: "templates",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
BusinessCategory.hasMany(MessageTemplate, {
  foreignKey: "category_id",
  as: "templates",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Report.belongsTo(User, {
  foreignKey: "user_id",
  as: "owner",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
User.hasMany(Report, {
  foreignKey: "user_id",
  as: "reports",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

/* =========================
 * Initialize scopes after wiring
 * =======================*/
if (typeof Business.initScopes === "function") Business.initScopes();
if (typeof User.initScopes === "function") User.initScopes();

/* =========================
 * Exports
 * =======================*/
module.exports = {
  // Core
  User,
  Business,
  BusinessCategory,

  // Messaging + catalog
  Customer,
  CustomerCategory,
  MessageTemplate,
  Report,

  // Feature flags
  Feature,
  BusinessFeature,
  UserFeature,
  UserPermission, // ✅ added export

  // Scheduling
  ScheduledMessage,

  // Packages
  BusinessPackage,
  BusinessPackageFeature,
  BusinessPackagePermission,
  BusinessUserPackage,
};
