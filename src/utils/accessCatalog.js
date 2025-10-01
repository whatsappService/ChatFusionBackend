// src/utils/accessCatalog.js
"use strict";

/**
 * Canonical / human-curated permission sets for each feature.
 * These are your defaults; DB-derived permissions will be added on top.
 */
const PERMISSIONS_BY_FEATURE = {
  // Customer Management
  customers: [
    "customers.read",
    "customers.create", 
    "customers.update",
    "customers.delete",
    "customers.manage",
  ],
  categories: [
    "categories.read",
    "categories.create",
    "categories.update", 
    "categories.delete",
  ],

  // Message System
  single_messages: ["messages.send.single", "messages.single.view"],
  bulk_send: ["messages.send.bulk", "messages.bulk.view"],
  group_messages: ["messages.groups.view"],
  scheduled_messages: [
    "schedules.read",
    "schedules.create",
    "schedules.update",
    "schedules.delete",
    "schedules.manage",
  ],
  media_attachments: ["media.read", "media.upload", "media.delete"],

  // Templates & Content
  templates: [
    "templates.read",
    "templates.create",
    "templates.update",
    "templates.delete",
    "templates.manage",
  ],
  placeholders: [
    "placeholders.read",
    "placeholders.create",
    "placeholders.update",
    "placeholders.delete",
  ],

  // Reports & Analytics
  reports: ["reports.read", "reports.export", "reports.manage"],
  analytics: ["reports.read", "reports.export", "analytics.view"],

  // User Management
  users: [
    "users.read",
    "users.create",
    "users.update", 
    "users.delete",
    "users.manage",
  ],
  multi_user: ["users.read", "users.create", "users.update"],

  // Package Management
  packages: [
    "packages.read",
    "packages.create",
    "packages.update",
    "packages.delete",
    "packages.manage",
  ],

  // WhatsApp Integration
  whatsapp: ["whatsapp.read", "whatsapp.manage", "whatsapp.auth"],

  // Media Management
  media: ["media.read", "media.upload", "media.delete", "media.manage"],

  // Settings & Configuration
  settings: ["settings.read", "settings.update", "settings.manage"],
  features: ["features.read", "features.write"],

  // Support System
  support: [], // No specific permissions (public access)

  // AI & Automation
  chatbot: ["chatbot.manage"],
  ai_chatbot: ["chatbot.manage"],

  // Integrations
  webhooks: ["webhooks.manage"],
  api_access: ["api.manage"],
};

/**
 * Canonical global permission list used to seed/augment `allPermissions`.
 * Add anything you use across the app here so the UI “knows” them even if
 * they don’t yet exist in DB.
 */
const CANONICAL_PERMS = [
  // Customer Management
  "customers.read",
  "customers.create",
  "customers.update", 
  "customers.delete",
  "customers.manage",
  "categories.read",
  "categories.create",
  "categories.update",
  "categories.delete",

  // Message System
  "messages.send.single",
  "messages.send.bulk",
  "messages.single.view",
  "messages.bulk.view",
  "messages.groups.view",
  "schedules.read",
  "schedules.create",
  "schedules.update",
  "schedules.delete",
  "schedules.manage",

  // Templates & Content
  "templates.read",
  "templates.create",
  "templates.update",
  "templates.delete",
  "templates.manage",
  "placeholders.read",
  "placeholders.create",
  "placeholders.update",
  "placeholders.delete",

  // Media Management
  "media.read",
  "media.upload",
  "media.delete",
  "media.manage",

  // Reports & Analytics
  "reports.read",
  "reports.export",
  "reports.manage",
  "analytics.view",

  // User Management
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
  "users.manage",

  // Package Management
  "packages.read",
  "packages.create",
  "packages.update",
  "packages.delete",
  "packages.manage",

  // WhatsApp Integration
  "whatsapp.read",
  "whatsapp.manage",
  "whatsapp.auth",

  // Settings & Configuration
  "settings.read",
  "settings.update",
  "settings.manage",
  "features.read",
  "features.write",

  // AI & Automation
  "chatbot.manage",

  // Integrations
  "webhooks.manage",
  "api.manage",
];

/**
 * When a feature’s permission prefix differs from its feature code, list it here.
 * The AccessCatalogService will include DB permissions that match these prefixes.
 *
 * e.g. feature `bulk_send` should collect `bulk.*`
 *      feature `multi_user` should collect `users.*` and `multiuser.*`
 */
const FEATURE_PERMISSION_PREFIX = {
  // Customer Management
  customers: ["customers"],
  categories: ["categories"],

  // Message System
  single_messages: ["messages"],
  bulk_send: ["messages"],
  group_messages: ["messages"],
  scheduled_messages: ["schedules"],
  media_attachments: ["media"],

  // Templates & Content
  templates: ["templates"],
  placeholders: ["placeholders"],

  // Media Management
  media: ["media"],

  // Reports & Analytics
  reports: ["reports"],
  analytics: ["reports", "analytics"],

  // User Management
  users: ["users"],
  multi_user: ["users"],

  // Package Management
  packages: ["packages"],

  // WhatsApp Integration
  whatsapp: ["whatsapp"],

  // Settings & Configuration
  settings: ["settings"],
  features: ["features"],

  // AI & Automation
  chatbot: ["chatbot"],
  ai_chatbot: ["chatbot"],

  // Integrations
  webhooks: ["webhooks"],
  api_access: ["api"],

  // Support System
  support: [], // No specific permissions
};

module.exports = {
  PERMISSIONS_BY_FEATURE,
  CANONICAL_PERMS,
  FEATURE_PERMISSION_PREFIX,
};
