// src/utils/acl.js
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

const match = (perm, need) => {
  if (perm === "*" || need === "*") return true;
  if (perm === need) return true;
  if (perm.endsWith(".*")) return need.startsWith(perm.slice(0, -2));
  return false;
};

function gatherRolePermissions(roles = []) {
  const perms = new Set();
  roles.forEach((r) => {
    (permissionMatrix[r] || []).forEach((p) => perms.add(p));
  });
  return [...perms];
}

function hasPermission({ roles = [], userOverrides = [] }, needed) {
  const rolePerms = gatherRolePermissions(roles);
  const allow = new Set([...(userOverrides.allow || []), ...rolePerms]);
  const deny = new Set(userOverrides.deny || []);

  for (const d of deny) if (match(d, needed)) return false;
  for (const a of allow) if (match(a, needed)) return true;
  return false;
}

/** NEW: convenience helper used by middleware/services */
function getUserPermissions(roles = []) {
  return new Set(gatherRolePermissions(roles)); // contains "*" for super-admin
}

module.exports = {
  permissionMatrix,
  hasPermission,
  gatherRolePermissions,
  getUserPermissions, // <-- export it
  match,
};
