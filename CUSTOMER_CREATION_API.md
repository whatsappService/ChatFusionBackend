# Customer Creation API Documentation

## Overview
This API endpoint allows you to create a new customer in the system. The customer will be associated with the authenticated user's business.

## Endpoint Details

**URL:** `POST /api/customers`  
**Method:** `POST`  
**Authentication:** Required (Bearer token)  
**Content-Type:** `application/json`

## Request Payload

### Headers
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Request Body
```json
{
  "profile_name": "John Doe",
  "whatsapp_number": "+1234567890",
  "gender": "male",
  "category_id": 1
}
```

### Request Parameters
| Parameter | Type | Required | Description | Example | Valid Values |
|-----------|------|----------|-------------|---------|--------------|
| `profile_name` | string | No | Customer's display name | `"John Doe"` | Any string |
| `whatsapp_number` | string | **Yes** | WhatsApp phone number (with country code) | `"+1234567890"` | Valid phone number format |
| `gender` | string | **Yes** | Customer's gender | `"male"` | `"male"`, `"female"`, `"not_set"` |
| `category_id` | integer | No | Customer category ID | `1` | Valid category ID or `null` |

## Response Structure

### Success Response (201) - Customer Created
```json
{
  "id": 1,
  "user_id": 123,
  "category_id": 1,
  "whatsapp_number": "+1234567890",
  "profile_name": "John Doe",
  "gender": "male",
  "status": "unverified",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### Error Response (400) - Missing Required Fields
```json
{
  "error": "whatsapp_number is required"
}
```

```json
{
  "error": "gender is required"
}
```

### Error Response (400) - Duplicate Phone Number
```json
{
  "error": "This phone number is already added"
}
```

### Error Response (500) - Invalid Category ID
```json
{
  "error": "Incorrect integer value: 'all' for column 'category_id' at row 1"
}
```

### Error Response (401) - Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### Error Response (403) - Forbidden
```json
{
  "error": "Forbidden"
}
```

## Response Fields

### Success Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique customer ID (auto-generated) |
| `user_id` | integer | ID of the authenticated user (auto-added) |
| `category_id` | integer | Customer category ID (nullable) |
| `whatsapp_number` | string | WhatsApp phone number |
| `profile_name` | string | Customer's display name (nullable) |
| `gender` | string | Customer's gender |
| `status` | string | Customer status (`"verified"` or `"unverified"`) |
| `createdAt` | string | Creation timestamp (ISO 8601) |
| `updatedAt` | string | Last update timestamp (ISO 8601) |

### Error Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Error message describing what went wrong |

## Usage Examples

### cURL Example
```bash
curl -X POST http://localhost:5550/api/customers \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_name": "John Doe",
    "whatsapp_number": "+1234567890",
    "gender": "male",
    "category_id": 1
  }'
```

### JavaScript Example
```javascript
const response = await fetch('/api/customers', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    profile_name: 'John Doe',
    whatsapp_number: '+1234567890',
    gender: 'male',
    category_id: 1
  })
});

const result = await response.json();
console.log(result);
```

### Python Example
```python
import requests

url = 'http://localhost:5550/api/customers'
headers = {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
}
data = {
    'profile_name': 'John Doe',
    'whatsapp_number': '+1234567890',
    'gender': 'male',
    'category_id': 1
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)
```

## Common Issues and Solutions

### 1. "Incorrect integer value: 'all' for column 'category_id'"
**Problem:** The `category_id` field is receiving the string `'all'` instead of an integer.

**Solution:** 
- Use a valid integer for `category_id` (e.g., `1`, `2`, `3`)
- Use `null` or omit the field if no category is needed
- Check that you're not accidentally passing query parameters from a filter

**Correct payload:**
```json
{
  "profile_name": "John Doe",
  "whatsapp_number": "+1234567890",
  "gender": "male",
  "category_id": 1
}
```

### 2. "This phone number is already added"
**Problem:** The WhatsApp number already exists in the system.

**Solution:** 
- Use a different phone number
- Check if the customer already exists before creating
- Update the existing customer instead of creating a new one

### 3. "whatsapp_number is required"
**Problem:** The `whatsapp_number` field is missing from the request.

**Solution:** 
- Always include the `whatsapp_number` field in your request
- Ensure the field name is exactly `whatsapp_number` (not `phone_number` or `phone`)

### 4. "gender is required"
**Problem:** The `gender` field is missing from the request.

**Solution:** 
- Always include the `gender` field with one of the valid values: `"male"`, `"female"`, or `"not_set"`

## Field Validation Rules

### Required Fields
- `whatsapp_number` (string): Must be a valid phone number format
- `gender` (string): Must be one of: `"male"`, `"female"`, `"not_set"`

### Optional Fields
- `profile_name` (string): Customer's display name
- `category_id` (integer): Must be a valid category ID or `null`

### Auto-Generated Fields
- `id` (integer): Auto-incremented primary key
- `user_id` (integer): Set to the authenticated user's ID
- `status` (string): Defaults to `"unverified"`
- `createdAt` (timestamp): Set to current time
- `updatedAt` (timestamp): Set to current time

## Related Endpoints

- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/categories` - Get customer categories
- `POST /api/customers/categories` - Create customer category

## Implementation Notes

1. **Authentication Required**: This endpoint requires a valid JWT token.

2. **Permission Required**: The user must have `customers.create` permission.

3. **Unique Constraint**: The `whatsapp_number` must be unique across all customers.

4. **Category Validation**: If `category_id` is provided, it must be a valid integer. Use `null` or omit the field if no category is needed.

5. **Phone Number Format**: WhatsApp numbers should include the country code (e.g., `+1234567890`).

6. **Gender Values**: Only `"male"`, `"female"`, or `"not_set"` are accepted for the gender field.
