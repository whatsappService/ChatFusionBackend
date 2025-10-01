# Update Customer API Documentation

## Overview
This API endpoint allows you to update an existing customer's information including profile name, WhatsApp number, category, and gender. The endpoint requires authentication and appropriate permissions.

## Endpoint Details

**URL:** `PUT /api/customers/{id}`  
**Method:** `PUT`  
**Authentication:** Required (Bearer JWT token)  
**Permission:** `customers.update`  
**Content-Type:** `application/json`

## Request Payload

### Headers
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### URL Parameters
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `id` | integer | Yes | Customer ID to update | `123` |

### Request Body
| Field | Type | Required | Description | Example | Validation |
|-------|------|----------|-------------|---------|------------|
| `profileName` | string | No | Customer's display name | `"John Doe"` | Max 255 characters |
| `whatsapp_number` | string | No | WhatsApp phone number | `"+1234567890"` | Must be unique |
| `whatsappNumber` | string | No | Alternative field name for WhatsApp number | `"+1234567890"` | Must be unique |
| `categoryId` | integer | No | Customer category ID | `5` | Must exist in categories |
| `gender` | string | No | Customer gender | `"male"`, `"female"`, `"not_set"` | Must be valid enum value |

### Example Request
```bash
PUT /api/customers/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "profileName": "John Smith",
  "whatsapp_number": "+1234567890",
  "categoryId": 5,
  "gender": "male"
}
```

## Response Structure

### Success Response (200) - Customer Updated
```json
{
  "id": 123,
  "user_id": 1,
  "category_id": 5,
  "whatsapp_number": "+1234567890",
  "profile_name": "John Smith",
  "gender": "male",
  "status": "verified",
  "createdAt": "2025-01-01T10:00:00.000Z",
  "updatedAt": "2025-01-01T12:30:00.000Z"
}
```

### Error Response (400) - Bad Request
```json
{
  "error": "Validation error message"
}
```

### Error Response (401) - Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "jwt malformed"
}
```

### Error Response (403) - Forbidden
```json
{
  "error": "Forbidden"
}
```

### Error Response (404) - Customer Not Found
```json
{
  "error": "Customer not found"
}
```

### Error Response (409) - Conflict (Duplicate Phone Number)
```json
{
  "error": "This phone number is already added"
}
```

### Error Response (500) - Server Error
```json
{
  "error": "Internal Server Error"
}
```

## Field Validation Rules

### Profile Name
- **Type**: String
- **Required**: No
- **Max Length**: 255 characters
- **Description**: Customer's display name

### WhatsApp Number
- **Type**: String
- **Required**: No
- **Format**: Phone number with country code
- **Uniqueness**: Must be unique across all customers
- **Alternative Fields**: `whatsapp_number` or `whatsappNumber`

### Category ID
- **Type**: Integer
- **Required**: No
- **Validation**: Must reference an existing category
- **Description**: Customer category for organization

### Gender
- **Type**: String (Enum)
- **Required**: No
- **Valid Values**: `"male"`, `"female"`, `"not_set"`
- **Default**: `"not_set"`

## Usage Examples

### cURL Example
```bash
curl -X PUT "http://localhost:5550/api/customers/123" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "profileName": "John Smith",
    "whatsapp_number": "+1234567890",
    "categoryId": 5,
    "gender": "male"
  }'
```

### JavaScript Example
```javascript
const response = await fetch('/api/customers/123', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    profileName: 'John Smith',
    whatsapp_number: '+1234567890',
    categoryId: 5,
    gender: 'male'
  })
});

if (response.ok) {
  const updatedCustomer = await response.json();
  console.log('Customer updated:', updatedCustomer);
} else {
  const error = await response.json();
  console.error('Error:', error);
}
```

### Python Example
```python
import requests
import json

url = 'http://localhost:5550/api/customers/123'
headers = {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
}
data = {
    'profileName': 'John Smith',
    'whatsapp_number': '+1234567890',
    'categoryId': 5,
    'gender': 'male'
}

response = requests.put(url, headers=headers, json=data)

if response.status_code == 200:
    customer = response.json()
    print('Customer updated:', customer)
else:
    error = response.json()
    print('Error:', error)
```

### PHP Example
```php
<?php
$url = 'http://localhost:5550/api/customers/123';
$data = [
    'profileName' => 'John Smith',
    'whatsapp_number' => '+1234567890',
    'categoryId' => 5,
    'gender' => 'male'
];

$options = [
    'http' => [
        'header' => [
            'Authorization: Bearer your_jwt_token',
            'Content-Type: application/json'
        ],
        'method' => 'PUT',
        'content' => json_encode($data)
    ]
];

$context = stream_context_create($options);
$result = file_get_contents($url, false, $context);

if ($result !== false) {
    $customer = json_decode($result, true);
    echo 'Customer updated: ' . json_encode($customer);
} else {
    echo 'Error updating customer';
}
?>
```

## Partial Updates

The API supports partial updates, meaning you can send only the fields you want to update:

### Update Only Profile Name
```json
{
  "profileName": "New Name"
}
```

### Update Only Category
```json
{
  "categoryId": 7
}
```

### Update Only Gender
```json
{
  "gender": "female"
}
```

## Data Processing Logic

1. **Authentication**: Validates JWT token
2. **Permission Check**: Verifies `customers.update` permission
3. **Customer Lookup**: Finds customer by ID
4. **Data Validation**: Validates input fields
5. **Uniqueness Check**: Ensures WhatsApp number is unique (if provided)
6. **Category Validation**: Verifies category exists (if provided)
7. **Update Execution**: Updates customer record
8. **Response**: Returns updated customer data

## Field Mapping

The API handles field name variations for flexibility:

| Request Field | Database Field | Description |
|---------------|----------------|-------------|
| `profileName` | `profile_name` | Customer's display name |
| `whatsapp_number` | `whatsapp_number` | WhatsApp phone number |
| `whatsappNumber` | `whatsapp_number` | Alternative field name |
| `categoryId` | `category_id` | Customer category ID |
| `gender` | `gender` | Customer gender |

## Error Handling

### Common Error Scenarios

1. **Customer Not Found (404)**
   - Customer ID doesn't exist
   - Customer was deleted

2. **Duplicate Phone Number (409)**
   - WhatsApp number already exists for another customer
   - Unique constraint violation

3. **Invalid Category (400)**
   - Category ID doesn't exist
   - Category belongs to different user

4. **Invalid Gender (400)**
   - Gender value not in allowed enum values
   - Invalid string format

5. **Validation Errors (400)**
   - Required fields missing
   - Invalid data types
   - Field length exceeded

## Related Endpoints

- `GET /api/customers/{id}` - Get customer by ID
- `POST /api/customers` - Create new customer
- `GET /api/customers` - Get all customers
- `DELETE /api/customers/{id}` - Delete customer
- `GET /api/customers/categories` - Get customer categories

## Database Schema

### Customer Table Structure
```sql
CREATE TABLE Customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  category_id INT NULL,
  whatsapp_number VARCHAR(255) NOT NULL UNIQUE,
  profile_name VARCHAR(255) NULL,
  gender ENUM('male', 'female', 'not_set') NOT NULL DEFAULT 'not_set',
  status ENUM('verified', 'unverified') DEFAULT 'unverified',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Implementation Notes

### Security
- JWT token validation required
- Permission-based access control
- User can only update their own customers

### Performance
- Single database query for update
- Indexed fields for fast lookups
- Optimized for small to medium datasets

### Data Integrity
- Unique constraint on WhatsApp numbers
- Foreign key validation for categories
- Enum validation for gender field

## Testing Examples

### Test Case 1: Successful Update
```bash
# Request
PUT /api/customers/123
{
  "profileName": "Updated Name",
  "gender": "female"
}

# Expected Response (200)
{
  "id": 123,
  "profile_name": "Updated Name",
  "gender": "female",
  "updatedAt": "2025-01-01T12:30:00.000Z"
}
```

### Test Case 2: Customer Not Found
```bash
# Request
PUT /api/customers/99999
{
  "profileName": "Test"
}

# Expected Response (404)
{
  "error": "Customer not found"
}
```

### Test Case 3: Duplicate Phone Number
```bash
# Request
PUT /api/customers/123
{
  "whatsapp_number": "+9876543210"
}

# Expected Response (409)
{
  "error": "This phone number is already added"
}
```
