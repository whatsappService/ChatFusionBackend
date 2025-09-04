// src/utils/acl.js
"use strict";

/** Role → permissions matrix */
const permissionMatrix = {
  "super-admin": ["*"],
  admin: [
    "webhooks.manage",
    "customers.read",
    "customers.write",
    "templates.read",
    "templates.write",
    "reports.view",
    "messages.read",
    "messages.send",
    "bulk.read",
    "bulk.send",
    "schedules.read",
    "schedules.create",
    "schedules.update",
    "schedules.delete",
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

/** Wildcard matcher: supports "*", "x.*" */
const match = (perm, need) => {
  if (perm === "*" || need === "*") return true;
  if (perm === need) return true;
  if (perm.endsWith(".*")) return need.startsWith(perm.slice(0, -2));
  return false;
};

/** Expand role list → flattened unique permission list */
function gatherRolePermissions(roles = []) {
  const perms = new Set();
  for (const r of roles) {
    const items = permissionMatrix[r] || [];
    for (const p of items) perms.add(p);
  }
  return [...perms];
}

/**
 * Core checker with safe handling for overrides.
 * overrides shape (all optional):
 *   { allow?: string[], deny?: string[] }
 * Deny always wins.
 */
function checkPermission(ctx, needed) {
  const roles = Array.isArray(ctx?.roles) ? ctx.roles : [];
  const rolePerms = gatherRolePermissions(roles);

  const overrides =
    ctx?.overrides && typeof ctx.overrides === "object" ? ctx.overrides : null;
  const allow = new Set([
    ...rolePerms,
    ...(Array.isArray(overrides?.allow) ? overrides.allow : []),
  ]);
  const deny = new Set(Array.isArray(overrides?.deny) ? overrides.deny : []);

  // Denies win
  for (const d of deny) if (match(d, needed)) return false;
  for (const a of allow) if (match(a, needed)) return true;
  return false;
}

/** Convenience: Set of resolved permissions (role + allow minus deny) */
function getUserPermissions(roles = [], overrides = null) {
  const allow = new Set(gatherRolePermissions(roles));
  if (Array.isArray(overrides?.allow))
    for (const p of overrides.allow) allow.add(p);
  if (Array.isArray(overrides?.deny))
    for (const p of overrides.deny) allow.delete(p);
  return allow; // Set<string>
}

module.exports = {
  permissionMatrix,
  match,
  gatherRolePermissions,
  checkPermission,
  getUserPermissions, // alias for callers that expect this
};
