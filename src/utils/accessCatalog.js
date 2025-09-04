// src/utils/accessCatalog.js
"use strict";

/**
 * Canonical / human-curated permission sets for each feature.
 * These are your defaults; DB-derived permissions will be added on top.
 */
const PERMISSIONS_BY_FEATURE = {
  // Messaging
  single_messages: ["messages.read", "messages.send"],
  bulk_send: ["bulk.read", "bulk.send"],
  scheduled_messages: [
    "schedules.read",
    "schedules.create",
    "schedules.update",
    "schedules.delete",
  ],

  // Templates & media
  templates: ["templates.read", "templates.write"],
  media_attachments: ["media.upload"],

  // Users & multi-user management
  users: ["users.read", "users.write", "users.manage", "users.invite"],
  multi_user: ["users.read", "users.write", "multiuser.manage"],

  // Customers
  customers: ["customers.read", "customers.write"],

  // Analytics / reports
  analytics: ["reports.view"],

  // Integrations & platform
  webhooks: ["webhooks.manage"],
  api_access: ["api.manage"],
  ai_chatbot: ["chatbot.manage"],

  // Feature management itself
  features: ["features.read", "features.write"],
};

/**
 * Canonical global permission list used to seed/augment `allPermissions`.
 * Add anything you use across the app here so the UI “knows” them even if
 * they don’t yet exist in DB.
 */
const CANONICAL_PERMS = [
  // Messaging
  "messages.read",
  "messages.send",
  "bulk.read",
  "bulk.send",
  "schedules.read",
  "schedules.create",
  "schedules.update",
  "schedules.delete",

  // Templates & media
  "templates.read",
  "templates.write",
  "media.upload",

  // Users & multi-user
  "users.read",
  "users.write",
  "users.manage",
  "users.invite",
  "multiuser.manage",

  // Customers
  "customers.read",
  "customers.write",

  // Analytics / reports
  "reports.view",

  // Integrations & platform
  "webhooks.manage",
  "api.manage",
  "chatbot.manage",

  // Feature administration
  "features.read",
  "features.write",
];

/**
 * When a feature’s permission prefix differs from its feature code, list it here.
 * The AccessCatalogService will include DB permissions that match these prefixes.
 *
 * e.g. feature `bulk_send` should collect `bulk.*`
 *      feature `multi_user` should collect `users.*` and `multiuser.*`
 */
const FEATURE_PERMISSION_PREFIX = {
  // Messaging
  single_messages: ["messages"],
  bulk_send: ["bulk", "messages"], // some teams also keep bulk under messages
  scheduled_messages: ["schedules"],

  // Templates & media
  templates: ["templates"],
  media_attachments: ["media"],

  // Users & multi-user
  users: ["users"],
  multi_user: ["users", "multiuser"],

  // Customers
  customers: ["customers"],

  // Analytics / reports
  analytics: ["reports", "analytics"],

  // Integrations & platform
  webhooks: ["webhooks"],
  api_access: ["api"],
  ai_chatbot: ["chatbot"],

  // Feature admin
  features: ["features"],
};

module.exports = {
  PERMISSIONS_BY_FEATURE,
  CANONICAL_PERMS,
  FEATURE_PERMISSION_PREFIX,
};
