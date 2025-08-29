// src/utils/acl.js
"use strict";

/** Role → permissions */
const permissionMatrix = {
  "super-admin": ["*"],

  admin: [
    "whatsapp.manage",
    "customers.read",
    "customers.create",
    "customers.update",
    "customers.delete",
    "categories.read",
    "categories.create",
    "categories.update",
    "categories.delete",
    "templates.read",
    "templates.create",
    "templates.update",
    "templates.delete",
    "analytics.view",
    "reports.export",
    "messages.single",
    "messages.bulk",
    "messages.schedule",
  ],

  "customer-manager": [
    "customers.read",
    "customers.create",
    "customers.update",
    "customers.delete",
    "categories.read",
    "categories.create",
    "categories.update",
    "categories.delete",
    "templates.read",
    "templates.create",
    "templates.update",
    "templates.delete",
  ],

  analyst: ["analytics.view", "reports.export"],
  "whatsapp-admin": ["whatsapp.manage"],
  member: ["customers.read", "templates.read", "messages.single"],
};

// wildcard matcher: "customers.*" matches "customers.read"
const match = (perm, need) => {
  if (perm === "*" || need === "*") return true;
  if (perm === need) return true;
  if (perm.endsWith(".*")) return need.startsWith(perm.slice(0, -2));
  return false;
};

function gatherRolePermissions(roles = []) {
  const perms = new Set();
  (Array.isArray(roles) ? roles : []).forEach((r) => {
    (permissionMatrix[r] || []).forEach((p) => perms.add(p));
  });
  return [...perms];
}

/**
 * Build a permission set from roles + optional user overrides:
 * overrides = { allow?: string[], deny?: string[] }
 */
function buildPermissionSet(roles = [], overrides = null) {
  const rolePerms = gatherRolePermissions(roles);

  const allowArr = Array.isArray(overrides?.allow) ? overrides.allow : [];
  const denyArr = Array.isArray(overrides?.deny) ? overrides.deny : [];

  const allow = new Set([...rolePerms, ...allowArr]);
  const deny = new Set(denyArr);

  return { allow, deny };
}

/** Check a single permission against allow/deny + wildcard rules */
function checkPermission({ roles = [], overrides = null }, needed) {
  const { allow, deny } = buildPermissionSet(roles, overrides);

  // explicit deny wins
  for (const d of deny) {
    if (match(d, needed)) return false;
  }
  // then allow
  for (const a of allow) {
    if (match(a, needed)) return true;
  }
  return false;
}

/** Back-compat alias some code might import */
const getUserPermissions = (roles = [], overrides = null) =>
  new Set([...buildPermissionSet(roles, overrides).allow]);

module.exports = {
  permissionMatrix,
  match,
  gatherRolePermissions,
  buildPermissionSet,
  checkPermission,
  getUserPermissions, // alias
};
