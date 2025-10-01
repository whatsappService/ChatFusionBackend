# Permission Error Resolution Guide

## Error Analysis

You're encountering this permission error:
```json
{
    "error": "PermissionDenied",
    "message": "You don't have the required permission.",
    "required": [
        "categories.create"
    ],
    "mode": "any"
}
```

This means you're trying to access an endpoint that requires the `categories.create` permission, but your current user doesn't have it.

## Understanding the Permission System

### Permission Structure
The system uses a hierarchical permission model:

1. **Role-based permissions** (from user roles)
2. **Package-based permissions** (from business packages)
3. **User-specific permissions** (overrides)
4. **Admin bypass** (admin role has all permissions)

### Available Roles and Their Permissions

#### 1. **Super Admin** (`super-admin`)
```json
{
  "roles": ["super-admin"],
  "permissions": ["*"]  // Has ALL permissions
}
```

#### 2. **Admin** (`admin`)
```json
{
  "roles": ["admin"],
  "permissions": [
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
    "schedules.delete"
  ]
}
```

#### 3. **Customer Manager** (`customer-manager`)
```json
{
  "roles": ["customer-manager"],
  "permissions": [
    "customers.read",
    "customers.create",
    "customers.update",
    "customers.delete",
    "categories.read",
    "categories.create",  // ✅ This role HAS categories.create
    "categories.update",
    "categories.delete",
    "templates.read",
    "templates.create",
    "templates.update",
    "templates.delete"
  ]
}
```

#### 4. **Analyst** (`analyst`)
```json
{
  "roles": ["analyst"],
  "permissions": [
    "analytics.view",
    "reports.export"
  ]
}
```

#### 5. **Member** (`member`)
```json
{
  "roles": ["member"],
  "permissions": [
    "customers.read",
    "templates.read",
    "messages.single"
  ]
}
```

## Solutions to Fix the Permission Error

### Solution 1: Assign Customer Manager Role
If you need to create categories, assign the `customer-manager` role:

```sql
-- Update user role
UPDATE Users 
SET roles = JSON_ARRAY('customer-manager') 
WHERE id = YOUR_USER_ID;
```

### Solution 2: Assign Admin Role
For full access, assign the `admin` role:

```sql
-- Update user role
UPDATE Users 
SET roles = JSON_ARRAY('admin') 
WHERE id = YOUR_USER_ID;
```

### Solution 3: Add Specific Permission
Add the specific permission to the user:

```sql
-- Add categories.create permission
INSERT INTO UserPermissions (user_id, perm, effect) 
VALUES (YOUR_USER_ID, 'categories.create', 'ALLOW');
```

### Solution 4: Assign Business Package
Assign a business package that includes the permission:

```sql
-- Find packages with categories.create permission
SELECT bp.id, bp.name, bpp.perm 
FROM BusinessPackages bp
JOIN BusinessPackagePermissions bpp ON bpp.package_id = bp.id
WHERE bpp.perm = 'categories.create';

-- Assign package to user
INSERT INTO BusinessUserPackages (user_id, package_id)
VALUES (YOUR_USER_ID, PACKAGE_ID);
```

## Checking Current User Permissions

### 1. Check User Roles
```sql
SELECT id, email, roles 
FROM Users 
WHERE id = YOUR_USER_ID;
```

### 2. Check User Permissions
```sql
SELECT up.perm, up.effect
FROM UserPermissions up
WHERE up.user_id = YOUR_USER_ID;
```

### 3. Check Package Permissions
```sql
SELECT bp.name, bpp.perm
FROM BusinessUserPackages bup
JOIN BusinessPackages bp ON bp.id = bup.package_id
JOIN BusinessPackagePermissions bpp ON bpp.package_id = bp.id
WHERE bup.user_id = YOUR_USER_ID;
```

## API Endpoints That Require categories.create

Based on the route configuration, these endpoints require `categories.create`:

- `POST /api/customers/categories` - Create new category

## Quick Fix Commands

### For Development/Testing
```sql
-- Make user admin (has all permissions)
UPDATE Users 
SET roles = JSON_ARRAY('admin') 
WHERE id = YOUR_USER_ID;
```

### For Production
```sql
-- Assign customer-manager role (has categories.create)
UPDATE Users 
SET roles = JSON_ARRAY('customer-manager') 
WHERE id = YOUR_USER_ID;
```

## Permission Hierarchy

The system checks permissions in this order:

1. **Admin Bypass**: If user has `admin` role → Allow
2. **Wildcard**: If user has `*` permission → Allow  
3. **Role Permissions**: Check user's role permissions
4. **Package Permissions**: Check business package permissions
5. **User Permissions**: Check specific user permissions
6. **Deny Overrides**: Remove any denied permissions

## Testing Permission Fix

After applying a fix, test with:

```bash
# Test the endpoint that was failing
curl -X POST "http://localhost:5550/api/customers/categories" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Category",
    "description": "Test category description"
  }'
```

## Common Permission Issues

### Issue 1: User has no roles
```sql
-- Fix: Assign a role
UPDATE Users SET roles = JSON_ARRAY('customer-manager') WHERE id = USER_ID;
```

### Issue 2: User has wrong role
```sql
-- Fix: Update role
UPDATE Users SET roles = JSON_ARRAY('admin') WHERE id = USER_ID;
```

### Issue 3: Permission denied by override
```sql
-- Check for deny overrides
SELECT * FROM UserPermissions 
WHERE user_id = USER_ID AND effect = 'DENY' AND perm = 'categories.create';

-- Remove deny override
DELETE FROM UserPermissions 
WHERE user_id = USER_ID AND effect = 'DENY' AND perm = 'categories.create';
```

## Permission Matrix Reference

| Role | customers.create | categories.create | templates.create | messages.send |
|------|------------------|-------------------|------------------|---------------|
| super-admin | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ❌ | ✅ | ✅ |
| customer-manager | ✅ | ✅ | ✅ | ❌ |
| analyst | ❌ | ❌ | ❌ | ❌ |
| member | ❌ | ❌ | ❌ | ❌ |

## Troubleshooting Steps

1. **Check current user permissions**:
   ```sql
   SELECT u.id, u.email, u.roles, up.perm, up.effect
   FROM Users u
   LEFT JOIN UserPermissions up ON up.user_id = u.id
   WHERE u.id = YOUR_USER_ID;
   ```

2. **Verify role assignment**:
   ```sql
   SELECT roles FROM Users WHERE id = YOUR_USER_ID;
   ```

3. **Check business packages**:
   ```sql
   SELECT bp.name, bpp.perm
   FROM BusinessUserPackages bup
   JOIN BusinessPackages bp ON bp.id = bup.package_id
   JOIN BusinessPackagePermissions bpp ON bpp.package_id = bp.id
   WHERE bup.user_id = YOUR_USER_ID;
   ```

4. **Test with admin role**:
   ```sql
   UPDATE Users SET roles = JSON_ARRAY('admin') WHERE id = YOUR_USER_ID;
   ```

## Prevention

To avoid permission issues:

1. **Assign appropriate roles** during user creation
2. **Use business packages** for feature-based permissions
3. **Test permissions** before deploying
4. **Document permission requirements** for each endpoint
5. **Use admin role** for development/testing environments
