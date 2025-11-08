# WhatsApp Multi-User API - Complete Documentation

Complete API documentation with all endpoints, request payloads, and response formats.

**Base URL:** `http://localhost:3880` (or `https://be.muraasala.com` for production)

**Request Format:** All POST/PUT requests use **form-data** (multipart/form-data)

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Status & Health](#status--health)
3. [WhatsApp Account Management](#whatsapp-account-management)
4. [Messaging](#messaging)
5. [Groups, Chats & Contacts](#groups-chats--contacts)
6. [Usage & Statistics](#usage--statistics)
7. [Message History](#message-history)
8. [User Management](#user-management)
9. [API Keys](#api-keys)
10. [Error Handling](#error-handling)

---

## Authentication

Most endpoints require API key authentication via header:

```http
X-API-Key: your_api_key_here
```

**Demo API Keys:**
- Messaging User: `11111111-1111-1111-1111-111111111111`
- OTP User: `44444444-4444-4444-4444-444444444444`
- SuperAdmin: `wa_superadmin_demo_key_123456`

---

## Status & Health

### Get Root Information

**Endpoint:** `GET /`

**Headers:** None required

**Response:**
```json
{
  "name": "WhatsApp Multi-User API",
  "version": "2.0.0",
  "status": "running",
  "environment": "development",
  "library_service": "http://whatsapp-library:3800",
  "documentation": "See API-MULTI-USER-SETUP.md for detailed documentation"
}
```

---

### Health Check

**Endpoint:** `GET /health`

**Headers:** None required

**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "library_service": "http://whatsapp-library:3800",
  "environment": "development"
}
```

**Error Response:**
```json
{
  "status": "error",
  "error": "Database connection failed"
}
```

---

### Get WhatsApp Status (Public)

**Endpoint:** `GET /api/whatsapp/status`

**Headers (Optional):**
```http
X-API-Key: your_api_key_here  # Optional - provides account details if authenticated
```

**Response (Public - No Authentication):**
```json
{
  "success": true,
  "whatsapp": {
    "status": "connected",
    "ready": true,
    "initialized": true,
    "authenticated": true,
    "has_qr": false,
    "needs_qr": false
  },
  "library_service": {
    "status": "reachable",
    "url": "http://whatsapp-library:3800"
  },
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

**Response (Authenticated):**
```json
{
  "success": true,
  "whatsapp": {
    "status": "connected",
    "ready": true,
    "initialized": true,
    "authenticated": true,
    "has_qr": false,
    "needs_qr": false
  },
  "library_service": {
    "status": "reachable",
    "url": "http://whatsapp-library:3800"
  },
  "account": {
    "id": 2,
    "name": "Demo Secondary Account",
    "phone": "0987654321",
    "status": "connected",
    "last_connected_at": "2024-01-20T12:25:04.000Z"
  },
  "user": {
    "id": 1,
    "name": "Demo User",
    "email": "demo@example.com"
  },
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

**Status Values:**
- `connected`: Client is ready and authenticated
- `initializing`: Client is being initialized
- `disconnected`: Client is not connected

---

## WhatsApp Account Management

### List All Accounts

**Endpoint:** `GET /api/accounts`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "accounts": [
    {
      "id": 1,
      "account_name": "Demo Primary Account",
      "phone_number": "1234567890",
      "status": "connected",
      "created_at": "2024-01-15T10:30:00.000Z",
      "last_connected_at": "2024-01-20T12:25:04.000Z"
    },
    {
      "id": 2,
      "account_name": "Demo Secondary Account",
      "phone_number": "0987654321",
      "status": "disconnected",
      "created_at": "2024-01-16T10:30:00.000Z",
      "last_connected_at": null
    }
  ]
}
```

---

### Get Account Details

**Endpoint:** `GET /api/account`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters:**
- `account_id` (optional): Specific account ID (default: auto-selects most recent connected account)

**Example:**
```
GET /api/account?account_id=2
```

**Response:**
```json
{
  "success": true,
  "account": {
    "id": 2,
    "account_name": "Demo Secondary Account",
    "phone_number": "0987654321",
    "status": "connected",
    "client_status": "ready",
    "created_at": "2024-01-16T10:30:00.000Z",
    "last_connected_at": "2024-01-20T12:25:04.000Z"
  }
}
```

**Note:** Account status automatically syncs with actual client state when this endpoint is called.

---

### Create WhatsApp Account

**Endpoint:** `POST /api/accounts`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Request Body (form-data):**
```
accountName: My WhatsApp Account
phoneNumber: 972595085600
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp account created successfully",
  "account": {
    "id": 3,
    "account_name": "My WhatsApp Account",
    "phone_number": "972595085600",
    "status": "pending",
    "created_at": "2024-01-20T15:30:00.000Z",
    "last_connected_at": null
  }
}
```

---

### Connect Account

**Endpoint:** `POST /api/account/connect`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `account_id`: Account ID to connect

**Request Body (form-data):**
```
accountId: 2
```

**Response:**
```json
{
  "success": true,
  "message": "Connection initiated. Wait a few seconds then get QR code at GET /api/qr?account_id=2",
  "account": {
    "id": 2,
    "name": "Demo Secondary Account",
    "phone": "0987654321",
    "status": "pending"
  },
  "next_step": {
    "endpoint": "/api/qr",
    "method": "GET",
    "query": "?account_id=2"
  }
}
```

**Workflow:**
1. Call `POST /api/account/connect?account_id=2`
2. Wait a few seconds
3. Call `GET /api/qr?account_id=2` to get QR code
4. Scan QR code with WhatsApp mobile app

---

### Get QR Code

**Endpoint:** `GET /api/qr`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters:**
- `account_id` (required): Account ID to get QR code for

**Example:**
```
GET /api/qr?account_id=2
```

**Response:**
```json
{
  "success": true,
  "qr_code": "2@Qu22TT/VS7TGbK5udptd+cK5tD3y/VaIyvmp9wQegDQvdTE9WNP+1xk0936b8LdX309kYXFWjZHFVlsTSfMC9/ZnmcXpz6dAo94=,o0B7F+gMLdn+pwLXen6cmzcktWm/R6d3gAaICR7HzyE=,SZI+BOsVmtqVX7NPLEwwamPSkw4yYcvmFEmJeUhxCkY=,q+zIId3LP8EG1R7D1nBQ/vTHu2VnLXd8R3Hws7TQ9E8=,1",
  "qr_code_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "message": "Scan this QR code with your WhatsApp mobile app",
  "account": {
    "id": 2,
    "name": "Demo Secondary Account"
  }
}
```

**Usage:**
- `qr_code`: Raw QR code string
- `qr_code_image`: Base64 encoded PNG image (use directly in `<img src="...">`)

---

### Reconnect Account

**Endpoint:** `POST /api/reconnect`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `account_id`: Account ID to reconnect

**Request Body (form-data):**
```
accountId: 2
```

**Response:**
```json
{
  "success": true,
  "message": "Reconnection initiated. Wait a few seconds then get QR code at GET /api/qr?account_id=2",
  "account": {
    "id": 2,
    "name": "Demo Secondary Account",
    "status": "pending"
  },
  "next_step": {
    "endpoint": "/api/qr",
    "method": "GET",
    "query": "?account_id=2"
  }
}
```

---

### Delete Account

**Endpoint:** `DELETE /api/account`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `account_id`: Account ID to delete

**Example:**
```
DELETE /api/account?account_id=2
```

**Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully",
  "deleted_account": {
    "id": 2,
    "name": "Demo Secondary Account"
  }
}
```

---

## Messaging

### Send Text Message

**Endpoint:** `POST /api/messages/send`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `account_id`: Account ID to send from (default: auto-select)

**Request Body (form-data):**
```
phone: 972568085611
message: Hello from WhatsApp API!
account_id: 1 (optional)
```

**Response:**
```json
{
  "success": true,
  "message_id": 123,
  "whatsapp_message_id": "3EB0C767F26A3C4A5E6F",
  "status": "sent",
  "recipient": "972568085611",
  "message": "Hello from WhatsApp API!",
  "account": {
    "id": 1,
    "name": "Demo Primary Account",
    "phone": "1234567890"
  },
  "sent_at": "2024-01-20T15:30:00.000Z"
}
```

---

### Send Media Message

**Endpoint:** `POST /api/messages/send-media`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `account_id`: Account ID to send from

**Request Body (form-data):**
```
phone: 972568085611
message: Check this image!
media: [FILE] (image, video, document, or audio)
account_id: 1 (optional)
```

**Supported Media Types:**
- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Videos: `video/mp4`, `video/3gpp`
- Documents: `application/pdf`, `application/vnd.ms-excel`, etc.
- Audio: `audio/mpeg`, `audio/ogg`, `audio/opus`

**Response:**
```json
{
  "success": true,
  "message_id": 124,
  "whatsapp_message_id": "3EB0C767F26A3C4A5E7G",
  "status": "sent",
  "recipient": "972568085611",
  "message": "Check this image!",
  "media": {
    "mimetype": "image/png",
    "filename": "image.png"
  },
  "account": {
    "id": 1,
    "name": "Demo Primary Account"
  },
  "sent_at": "2024-01-20T15:30:00.000Z"
}
```

---

### Send Bulk Messages

**Endpoint:** `POST /api/messages/bulk`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `account_id`: Account ID to send from

**Request Body (form-data):**
```
phones: ["972568085611", "972595085600", "972501234567"] (JSON string)
message: Hello everyone! This is a bulk message.
media: [FILE] (optional)
account_id: 1 (optional)
```

**Response:**
```json
{
  "success": true,
  "bulk_message_id": 6,
  "total_recipients": 3,
  "successful": 3,
  "failed": 0,
  "status": "processing",
  "message": "Hello everyone! This is a bulk message.",
  "account": {
    "id": 1,
    "name": "Demo Primary Account",
    "phone": "1234567890"
  },
  "created_at": "2024-01-20T15:30:00.000Z"
}
```

**Note:** Bulk messages are processed asynchronously. Use `GET /api/messages/bulk/:bulkId` to check progress.

---

### Send Group Message

**Endpoint:** `POST /api/messages/group`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Request Body (form-data):**
```
groupId: 123456789-1234567890@g.us
message: Hello group members!
```

**Response:**
```json
{
  "success": true,
  "message_id": 125,
  "whatsapp_message_id": "3EB0C767F26A3C4A5E8H",
  "status": "sent",
  "group_id": "123456789-1234567890@g.us",
  "message": "Hello group members!",
  "sent_at": "2024-01-20T15:30:00.000Z"
}
```

---

### Send Multiple Group Messages

**Endpoint:** `POST /api/messages/group`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Request Body (form-data):**
```
groupId: 123456789-1234567890@g.us
messages: ["First message", "Second message", "Third message"] (JSON string)
attachments: [FILE] (optional, sent with last message)
```

**Response:**
```json
{
  "success": true,
  "total_messages": 3,
  "successful": 3,
  "failed": 0,
  "results": [
    {
      "message": "First message",
      "status": "sent",
      "message_id": 126,
      "whatsapp_message_id": "3EB0C767F26A3C4A5E9I"
    },
    {
      "message": "Second message",
      "status": "sent",
      "message_id": 127,
      "whatsapp_message_id": "3EB0C767F26A3C4A5E9J"
    },
    {
      "message": "Third message",
      "status": "sent",
      "message_id": 128,
      "whatsapp_message_id": "3EB0C767F26A3C4A5E9K",
      "has_attachments": true
    }
  ],
  "group_id": "123456789-1234567890@g.us",
  "sent_at": "2024-01-20T15:30:00.000Z"
}
```

**Note:** Messages are sent sequentially with a 1-second delay between each. Attachments are sent with the last message.

---

### Send OTP Message

**Endpoint:** `POST /api/messages/send-otp`

**Headers:**
```http
X-API-Key: your_api_key_here (must be OTP user)
```

**Query Parameters (Optional):**
- `account_id`: Account ID to send from

**Request Body (form-data):**
```
phoneNumber: 972568085611
otpCode: 123456
account_id: 1 (optional)
```

**Response:**
```json
{
  "success": true,
  "message_id": 129,
  "whatsapp_message_id": "3EB0C767F26A3C4A5E9L",
  "status": "sent",
  "recipient": "972568085611",
  "otp_code": "123456",
  "account": {
    "id": 1,
    "name": "Demo Primary Account"
  },
  "sent_at": "2024-01-20T15:30:00.000Z"
}
```

**Note:** This endpoint only works for users with `default_message_type='otp'`.

---

## Groups, Chats & Contacts

### Get All Groups

**Endpoint:** `GET /api/groups`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "groups": [
    {
      "id": {
        "_serialized": "120363123456789012@g.us"
      },
      "name": "Family Group",
      "isGroup": true,
      "participantsCount": 10
    },
    {
      "id": {
        "_serialized": "120363123456789013@g.us"
      },
      "name": "Work Team",
      "isGroup": true,
      "participantsCount": 15
    }
  ]
}
```

---

### Get All Chats

**Endpoint:** `GET /api/chats`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "count": 20,
  "chats": [
    {
      "id": {
        "_serialized": "972568085611@c.us"
      },
      "name": "John Doe",
      "isGroup": false,
      "unreadCount": 2
    },
    {
      "id": {
        "_serialized": "120363123456789012@g.us"
      },
      "name": "Family Group",
      "isGroup": true,
      "unreadCount": 5
    }
  ]
}
```

---

### Get All Contacts

**Endpoint:** `GET /api/contacts`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Response:**
```json
{
  "success": true,
  "count": 150,
  "contacts": [
    {
      "id": {
        "_serialized": "972568085611@c.us"
      },
      "name": "John Doe",
      "number": "972568085611",
      "isBusiness": false,
      "isMyContact": true
    },
    {
      "id": {
        "_serialized": "972595085600@c.us"
      },
      "name": "Jane Smith",
      "number": "972595085600",
      "isBusiness": true,
      "isMyContact": true
    }
  ]
}
```

---

## Usage & Statistics

### Get Usage Statistics

**Endpoint:** `GET /api/usage`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `period`: `today`, `week`, `month`, `all` (default: `all`)
- `startDate`: `YYYY-MM-DD`
- `endDate`: `YYYY-MM-DD`

**Example:**
```
GET /api/usage?period=today
GET /api/usage?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "usage": {
    "user_id": 1,
    "limit_type": "limited",
    "message_limit": 1000,
    "messages_sent": 750,
    "messages_remaining": 250,
    "reset_period": "monthly",
    "reset_date": "2024-02-01T00:00:00.000Z",
    "total_messages": 1250,
    "sent": 1200,
    "delivered": 1180,
    "failed": 50,
    "pending": 20
  }
}
```

**Note:** Usage counts all messages from all accounts for the user.

---

### Update Usage Limits (Admin)

**Endpoint:** `PUT /api/admin/usage-limits/:userId`

**Headers:**
```http
X-API-Key: your_superadmin_api_key_here
```

**URL Parameters:**
- `userId`: User ID to update limits for

**Request Body (form-data):**
```
limitType: limited
messageLimit: 1000
resetPeriod: monthly
```

**Field Values:**
- `limitType`: `limited` or `unlimited`
- `messageLimit`: Positive integer (required if `limitType='limited'`)
- `resetPeriod`: `monthly`, `yearly`, or `never` (default: `monthly`)

**Response:**
```json
{
  "success": true,
  "usage_limit": {
    "id": 3,
    "user_id": 5,
    "limit_type": "limited",
    "message_limit": 1000,
    "reset_period": "monthly",
    "updated_at": "2024-01-20T14:45:00.000Z"
  }
}
```

---

## Message History

### Get All Messages

**Endpoint:** `GET /api/messages`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `page`: Page number (default: 1)
- `limit`: Messages per page (default: 50, max: 100)
- `status`: Filter by status (`sent`, `delivered`, `failed`, `pending`)
- `account_id`: Filter by account ID
- `startDate`: Start date (`YYYY-MM-DD`)
- `endDate`: End date (`YYYY-MM-DD`)

**Example:**
```
GET /api/messages?page=1&limit=50&status=sent&account_id=1
GET /api/messages?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "totalPages": 25
  },
  "messages": [
    {
      "id": 123,
      "whatsapp_message_id": "3EB0C767F26A3C4A5E6F",
      "recipient": "972568085611",
      "message": "Hello from WhatsApp API!",
      "status": "sent",
      "delivered_at": "2024-01-20T15:30:05.000Z",
      "sent_at": "2024-01-20T15:30:00.000Z",
      "account": {
        "id": 1,
        "name": "Demo Primary Account"
      }
    }
  ]
}
```

---

### Get Message by ID

**Endpoint:** `GET /api/messages/:messageId`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**URL Parameters:**
- `messageId`: Message ID

**Example:**
```
GET /api/messages/123
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": 123,
    "whatsapp_message_id": "3EB0C767F26A3C4A5E6F",
    "recipient": "972568085611",
    "message": "Hello from WhatsApp API!",
    "status": "sent",
    "delivered_at": "2024-01-20T15:30:05.000Z",
    "sent_at": "2024-01-20T15:30:00.000Z",
    "account": {
      "id": 1,
      "name": "Demo Primary Account"
    }
  }
}
```

---

### Get Bulk Message Progress

**Endpoint:** `GET /api/messages/bulk/:bulkId`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**URL Parameters:**
- `bulkId`: Bulk message ID

**Example:**
```
GET /api/messages/bulk/6
```

**Response:**
```json
{
  "success": true,
  "progress": {
    "id": 6,
    "status": "completed",
    "total_recipients": 100,
    "completed": 100,
    "failed": 0,
    "pending": 0,
    "created_at": "2024-01-20T15:30:00.000Z",
    "completed_at": "2024-01-20T15:35:00.000Z"
  }
}
```

---

### Get Bulk Message Details

**Endpoint:** `GET /api/messages/bulk/:bulkId/details`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**URL Parameters:**
- `bulkId`: Bulk message ID

**Example:**
```
GET /api/messages/bulk/6/details
```

**Response:**
```json
{
  "success": true,
  "bulk_message": {
    "id": 6,
    "status": "completed",
    "message": "Hello everyone!",
    "total_recipients": 3,
    "completed": 3,
    "failed": 0,
    "created_at": "2024-01-20T15:30:00.000Z",
    "recipients": [
      {
        "id": 1,
        "phone": "972568085611",
        "status": "sent",
        "message_id": 130,
        "sent_at": "2024-01-20T15:30:05.000Z"
      },
      {
        "id": 2,
        "phone": "972595085600",
        "status": "sent",
        "message_id": 131,
        "sent_at": "2024-01-20T15:30:10.000Z"
      },
      {
        "id": 3,
        "phone": "972501234567",
        "status": "sent",
        "message_id": 132,
        "sent_at": "2024-01-20T15:30:15.000Z"
      }
    ]
  }
}
```

---

### Get Message Reports

**Endpoint:** `GET /api/reports/messages`

**Headers:**
```http
X-API-Key: your_api_key_here
```

**Query Parameters (Optional):**
- `startDate`: Start date (`YYYY-MM-DD`)
- `endDate`: End date (`YYYY-MM-DD`)
- `account_id`: Filter by account ID

**Example:**
```
GET /api/reports/messages?startDate=2024-01-01&endDate=2024-01-31&account_id=1
```

**Response:**
```json
{
  "success": true,
  "report": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "total_messages": 1250,
    "by_status": {
      "sent": 1200,
      "delivered": 1180,
      "failed": 50,
      "pending": 20
    },
    "by_account": [
      {
        "account_id": 1,
        "account_name": "Demo Primary Account",
        "total": 800,
        "sent": 780,
        "delivered": 760,
        "failed": 20
      },
      {
        "account_id": 2,
        "account_name": "Demo Secondary Account",
        "total": 450,
        "sent": 420,
        "delivered": 420,
        "failed": 30
      }
    ]
  }
}
```

---

## User Management

### Create User (SuperAdmin)

**Endpoint:** `POST /api/admin/users`

**Headers:**
```http
X-API-Key: your_superadmin_api_key_here
```

**Request Body (form-data):**
```
name: New User
email: newuser@example.com
companyName: Test Company (optional)
default_message_type: messaging
role: user
messageLimit: 1000
```

**Field Values:**
- `default_message_type`: `messaging` or `otp` (default: `messaging`)
- `role`: `user`, `provider`, or `superadmin` (default: `user`)
- `messageLimit`: `-1` for unlimited, or positive number (default: `-1`)

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": 5,
    "name": "New User",
    "email": "newuser@example.com",
    "company_name": "Test Company",
    "role": "user",
    "default_message_type": "messaging",
    "status": "active",
    "created_at": "2024-01-20T15:30:00.000Z"
  },
  "api_key": {
    "key": "wa_abc123def456...",
    "name": "Default API Key",
    "expires_at": null
  },
  "usage_limit": {
    "type": "limited",
    "message_limit": 1000,
    "reset_period": "monthly"
  }
}
```

---

### Create User (Provider)

**Endpoint:** `POST /api/provider/users`

**Headers:**
```http
X-API-Key: your_provider_api_key_here
```

**Request Body (form-data):**
```
name: Client User
email: client@example.com
companyName: Client Company (optional)
default_message_type: otp
messageLimit: 500
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": 6,
    "name": "Client User",
    "email": "client@example.com",
    "company_name": "Client Company",
    "role": "user",
    "default_message_type": "otp",
    "status": "active",
    "created_at": "2024-01-20T15:30:00.000Z"
  },
  "api_key": {
    "key": "wa_xyz789abc123...",
    "name": "Default API Key",
    "expires_at": null
  },
  "usage_limit": {
    "type": "limited",
    "message_limit": 500,
    "reset_period": "monthly"
  }
}
```

**Note:** Providers can only create regular users (role='user').

---

### List My Users (Provider)

**Endpoint:** `GET /api/provider/users`

**Headers:**
```http
X-API-Key: your_provider_api_key_here
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "users": [
    {
      "id": 6,
      "name": "Client User 1",
      "email": "client1@example.com",
      "company_name": "Client Company 1",
      "role": "user",
      "status": "active",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 7,
      "name": "Client User 2",
      "email": "client2@example.com",
      "company_name": "Client Company 2",
      "role": "user",
      "status": "active",
      "created_at": "2024-01-16T10:30:00.000Z"
    }
  ]
}
```

---

### List My Accounts (Provider)

**Endpoint:** `GET /api/provider/accounts`

**Headers:**
```http
X-API-Key: your_provider_api_key_here
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "accounts": [
    {
      "id": 1,
      "account_name": "Client 1 Account",
      "phone_number": "1234567890",
      "status": "connected",
      "user": {
        "id": 6,
        "name": "Client User 1",
        "email": "client1@example.com",
        "company_name": "Client Company 1",
        "status": "active"
      }
    }
  ]
}
```

---

## API Keys

### Generate API Key

**Endpoint:** `POST /api/admin/api-keys`

**Headers:**
```http
X-API-Key: your_superadmin_api_key_here
```

**Request Body (form-data):**
```
userId: 2
name: Production Key
expiresAt: (optional, ISO format date, leave empty for no expiration)
```

**Response:**
```json
{
  "success": true,
  "api_key": {
    "key": "wa_production_key_abc123def456...",
    "name": "Production Key",
    "user_id": 2,
    "expires_at": null,
    "created_at": "2024-01-20T15:30:00.000Z"
  },
  "message": "API key generated successfully. Save this key securely - it will not be shown again."
}
```

**Important:** The API key is only shown once. Save it securely.

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid API key
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Common Error Messages

**Authentication Errors:**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

**Validation Errors:**
```json
{
  "success": false,
  "error": "Invalid phone number format"
}
```

**Usage Limit Errors:**
```json
{
  "success": false,
  "error": "Usage limit exceeded. Daily limit: 1000, Used: 1000, Remaining: 0"
}
```

**Account Errors:**
```json
{
  "success": false,
  "error": "WhatsApp client is not ready. Please connect your account first."
}
```

**Permission Errors:**
```json
{
  "success": false,
  "error": "Access denied. This endpoint requires SuperAdmin role."
}
```

---

## Account Selection

Most endpoints support account selection via:

1. **Query Parameter:**
   ```
   GET /api/account?account_id=2
   POST /api/messages/send?account_id=2
   ```

2. **Form Data (for POST/PUT):**
   ```
   account_id: 2
   ```

3. **Auto-Select:**
   - If no `account_id` is provided, the system auto-selects:
     - First connected account, or
     - Most recently connected account, or
     - First available account

---

## Account Status Sync

Account status automatically syncs with actual client state:

- **When client is ready** → Account status updates to `connected`
- **When client disconnects** → Account status updates to `disconnected`
- **Status synced when:**
  - Getting account details (`GET /api/account`)
  - Listing accounts (`GET /api/accounts`)
  - Getting WhatsApp status (`GET /api/whatsapp/status`)

---

## Notes

1. **Form-Data Format:** All POST/PUT requests use `multipart/form-data`
2. **Arrays in Form-Data:** Arrays (like `phones`, `messages`) should be sent as JSON strings
3. **File Uploads:** Media files are uploaded directly in form-data
4. **Account Selection:** Use `account_id` in query or form-data to select specific account
5. **Status Sync:** Account status automatically syncs with client state
6. **Usage Limits:** One usage counter per user (aggregates all accounts)
7. **Multi-Account:** Users can have multiple accounts, but only one can be connected at a time

---

## Support

For issues or questions:
- Check the logs: `api-backend/logs/app.log`
- Review the Postman collection: `postman/WhatsApp-API-Updated.postman_collection.json`
- See detailed guides in the repository

---

**Last Updated:** 2024-01-20  
**API Version:** 2.0.0


