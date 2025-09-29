# WhatsApp Portal Backend API Documentation

## Table of Contents
1. [Backend API Endpoints](#backend-api-endpoints)
2. [ChatFusion API Integration](#chatfusion-api-integration)
3. [Response Formats](#response-formats)
4. [Error Handling](#error-handling)

## Backend API Endpoints

### Authentication Routes (`/api/auth`)

#### POST `/api/auth/login`
**Request:**
```json
{
  "email_address": "user@example.com",
  "password": "password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email_address": "user@example.com",
    "role": "admin",
    "business_id": 1
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

#### POST `/api/auth/register`
**Request:**
```json
{
  "email_address": "newuser@example.com",
  "password": "password",
  "role": "user"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": 2,
    "email_address": "newuser@example.com",
    "role": "user",
    "business_id": 1
  }
}
```

### User Routes (`/api/users`)

#### GET `/api/users`
**Success Response (200):**
```json
{
  "users": [
    {
      "id": 1,
      "email_address": "user@example.com",
      "role": "admin",
      "business_id": 1,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 0,
  "limit": 10
}
```

#### GET `/api/users/:id`
**Success Response (200):**
```json
{
  "id": 1,
  "email_address": "user@example.com",
  "role": "admin",
  "business_id": 1,
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Error Response (404):**
```json
{
  "error": "User not found"
}
```

#### POST `/api/users/verify-password`
**Request:**
```json
{
  "password": "current_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password verified"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid password"
}
```

### WhatsApp Routes (`/api/whatsapp`)

#### GET `/api/whatsapp/status`
**Success Response (200):**
```json
{
  "success": true,
  "status": "connected",
  "message": "WhatsApp is connected",
  "data": {
    "connected": true,
    "phoneNumber": "+1234567890",
    "lastSeen": "2025-01-01T00:00:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "WhatsApp is not connected",
  "error": "WhatsApp Status Error: Unauthorized - Invalid API key or expired credentials"
}
```

#### GET `/api/whatsapp/connect`
**Success Response (200):**
```json
{
  "success": true,
  "message": "QR code generated",
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "expiresIn": 300
  }
}
```

#### POST `/api/whatsapp/check-whatsapp-number`
**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Phone number is registered on WhatsApp",
  "data": {
    "phoneNumber": "+1234567890",
    "registered": true,
    "whatsappId": "1234567890@c.us"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Phone number is not registered on WhatsApp",
  "data": {
    "phoneNumber": "+1234567890",
    "registered": false
  }
}
```

### Message Routes (`/api/messages`)

#### POST `/api/messages/send-single`
**Request:**
```json
{
  "recipient": "+1234567890",
  "contents": ["Hello, this is a test message!"]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "recipient": "+1234567890",
    "messageId": "msg_123456",
    "status": "sent"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "WhatsApp is not connected. Please scan the QR code to connect.",
  "error": "whatsapp_not_connected"
}
```

#### POST `/api/messages/sendBulk`
**Request:**
```json
{
  "globalMessages": ["Global message"],
  "recipientsData": [
    {
      "recipient": "+1234567890",
      "personalMessages": ["Personal message"]
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Bulk messages sent successfully",
  "data": {
    "totalMessages": 2,
    "successCount": 2,
    "failedCount": 0,
    "failedMessages": []
  }
}
```

### Customer Routes (`/api/customers`)

#### GET `/api/customers`
**Success Response (200):**
```json
{
  "customers": [
    {
      "id": 1,
      "name": "John Doe",
      "whatsapp_number": "+1234567890",
      "gender": "male",
      "category_id": 1,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 0,
  "limit": 10
}
```

#### POST `/api/customers`
**Request:**
```json
{
  "name": "John Doe",
  "whatsapp_number": "+1234567890",
  "gender": "male",
  "category_id": 1
}
```

**Success Response (201):**
```json
{
  "id": 1,
  "name": "John Doe",
  "whatsapp_number": "+1234567890",
  "gender": "male",
  "category_id": 1,
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

### History Routes (`/api/history`)

#### GET `/api/history/user-history`
**Success Response (200):**
```json
{
  "success": true,
  "message": "History retrieved successfully",
  "data": {
    "totalMessages": 100,
    "totalHistory": 25,
    "reports": [
      {
        "id": "history_123",
        "messageCount": 5,
        "successCount": 5,
        "failedCount": 0,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  },
  "pagination": {
    "page": 0,
    "limit": 10,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## ChatFusion API Integration

### APIs that call chatfusion.murraltd.com

#### 1. WhatsApp Status Check
**Endpoint:** `GET /api/whatsapp/status`
**ChatFusion Call:** `GET https://chatfusion.murraltd.com/api/whatsapp/status`
**Headers:** `x-api-key: {api_key}`

**ChatFusion Response:**
```json
{
  "success": true,
  "status": "whatsapp_status_checked",
  "statusCode": 200,
  "message": "WhatsApp connection status checked successfully",
  "timestamp": "2025-09-29T01:52:09.649Z",
  "requestId": "a684db24-36c7-46da-b2f0-a8d933468277",
  "data": {
    "accounts": {
      "primary": {
        "status": {
          "connected": false,
          "message": "Session not initialized"
        },
        "accountType": "primary",
        "isConnected": false
      }
    },
    "summary": {
      "totalAccounts": 1,
      "connectedAccounts": 0,
      "disconnectedAccounts": 1,
      "readyToSend": false,
      "serviceStatus": "needs_connection"
    }
  }
}
```

#### 2. WhatsApp Connect
**Endpoint:** `GET /api/whatsapp/connect`
**ChatFusion Call:** `GET https://chatfusion.murraltd.com/api/whatsapp/connect`
**Headers:** `x-api-key: {api_key}`

**ChatFusion Response:**
```json
{
  "success": true,
  "status": "whatsapp_connection_status",
  "statusCode": 200,
  "message": "WhatsApp connection status retrieved successfully",
  "data": {
    "primaryAccount": {
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "status": {
        "connected": false,
        "message": "Session not initialized"
      }
    }
  }
}
```

#### 3. Check WhatsApp Number
**Endpoint:** `POST /api/whatsapp/check-whatsapp-number`
**ChatFusion Call:** `GET https://chatfusion.murraltd.com/api/whatsapp/check-whatsapp-number?phone={phone}`
**Headers:** `x-api-key: {api_key}`

**ChatFusion Response (Registered):**
```json
{
  "success": true,
  "status": "phone_number_verified",
  "statusCode": 200,
  "message": "Phone number check completed",
  "data": {
    "phoneNumber": "1234567890",
    "registered": true,
    "status": "registered",
    "whatsappId": "1234567890@c.us",
    "contactName": "John Doe"
  }
}
```

**ChatFusion Response (Not Registered):**
```json
{
  "success": true,
  "status": "phone_number_checked",
  "statusCode": 200,
  "message": "Phone number check completed",
  "data": {
    "phoneNumber": "1234567890",
    "registered": false,
    "status": "not_registered",
    "message": "This phone number is not registered on WhatsApp"
  }
}
```

#### 4. Send Single Message
**Endpoint:** `POST /api/messages/send-single`
**ChatFusion Call:** `POST https://chatfusion.murraltd.com/api/messaging/send`
**Headers:** `x-api-key: {api_key}`

**ChatFusion Response:**
```json
{
  "success": true,
  "status": "success",
  "statusCode": 200,
  "message": "Message sent successfully",
  "data": {
    "recipient": "1234567890",
    "totalMessages": 1,
    "successCount": 1,
    "failedCount": 0,
    "failedMessages": []
  }
}
```

#### 5. Send Bulk Messages
**Endpoint:** `POST /api/messages/sendBulk`
**ChatFusion Call:** `POST https://chatfusion.murraltd.com/api/messaging/sendBulk`
**Headers:** `x-api-key: {api_key}`

**ChatFusion Response:**
```json
{
  "success": true,
  "status": "success",
  "statusCode": 200,
  "message": "Bulk messages sent successfully",
  "data": {
    "totalMessages": 4,
    "successCount": 4,
    "failedCount": 0,
    "failedMessages": []
  }
}
```

#### 6. Get WhatsApp Contacts
**Endpoint:** `GET /api/customers/sync-whatsapp`
**ChatFusion Call:** `GET https://chatfusion.murraltd.com/api/whatsapp/contact`
**Headers:** `x-api-key: {api_key}`

**ChatFusion Response:**
```json
[
  {
    "id": "1234567890@c.us",
    "name": "John Doe",
    "phoneNumber": "1234567890",
    "isRegistered": true
  },
  {
    "id": "0987654321@c.us",
    "name": "Jane Smith",
    "phoneNumber": "0987654321",
    "isRegistered": true
  }
]
```

#### 7. Get Message History
**Endpoint:** `GET /api/history/user-history`
**ChatFusion Call:** `GET https://chatfusion.murraltd.com/api/history`
**Headers:** `x-api-key: {api_key}`

**ChatFusion Response:**
```json
{
  "success": true,
  "status": "history_retrieved",
  "statusCode": 200,
  "message": "Message history retrieved successfully",
  "data": {
    "totalMessages": 41,
    "totalHistory": 15,
    "reports": [
      {
        "id": "history-id-1",
        "messageCount": 5,
        "successCount": 5,
        "failedCount": 0,
        "createdAt": "2025-09-28T18:24:51.000Z"
      }
    ]
  }
}
```

## Response Formats

### Success Response Format
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response payload
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Error type",
  "details": {
    // Additional error context
  }
}
```

## Error Handling

### Common Error Types

#### 1. Authentication Errors (401)
```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Authentication Error"
}
```

#### 2. Validation Errors (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Validation Error",
  "details": {
    "field": "recipient",
    "message": "Recipient is required"
  }
}
```

#### 3. WhatsApp Connection Errors (400)
```json
{
  "success": false,
  "message": "WhatsApp is not connected. Please scan the QR code to connect.",
  "error": "whatsapp_not_connected"
}
```

#### 4. ChatFusion API Errors (500)
```json
{
  "success": false,
  "message": "WhatsApp Status Error: Unauthorized - Invalid API key or expired credentials",
  "error": "ChatFusion API Error",
  "source": "WhatsApp Service"
}
```

#### 5. Network Errors (500)
```json
{
  "success": false,
  "message": "WhatsApp Status Error: Cannot connect to ChatFusion API - Network or DNS issue",
  "error": "Network Error",
  "source": "WhatsApp Service"
}
```

### Error Status Codes

| Status Code | Description | Common Causes |
|-------------|-------------|---------------|
| 200 | Success | Operation completed successfully |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable Entity | Validation errors |
| 500 | Internal Server Error | Server errors, external API failures |

## Rate Limiting

The API implements rate limiting:
- **Rate Limit**: 1000 requests per 15 minutes per IP
- **Headers**: Rate limit information included in response headers
- **Exceeded**: Returns 429 status code

## Authentication

All endpoints (except health check) require JWT authentication:
```
Authorization: Bearer {jwt_token}
```

## File Upload Support

Message endpoints support file uploads:
- **Max File Size**: 25MB per file
- **Max Files**: 50 files per request
- **Supported Types**: Images, videos, audio, PDF, Excel files
- **Field Names**: `files`, `globalFiles`, `personalFiles`
