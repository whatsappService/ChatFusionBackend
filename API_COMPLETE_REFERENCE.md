# ChatFusion Backend API - Complete Reference

Complete documentation of all APIs in the ChatFusion WhatsApp Backend system.

**Base URL:** `http://localhost:5550` (or your production URL)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Authentication APIs](#authentication-apis)
3. [WhatsApp Connection APIs](#whatsapp-connection-apis)
4. [Messaging APIs](#messaging-apis)
5. [Message History APIs](#message-history-apis)
6. [Usage Tracking APIs](#usage-tracking-apis)
7. [Customer Management APIs](#customer-management-apis)
8. [Scheduled Messages APIs](#scheduled-messages-apis)
9. [Message Templates APIs](#message-templates-apis)
10. [User Management APIs](#user-management-apis)
11. [Business Management APIs](#business-management-apis)
12. [Groups & Contacts APIs](#groups--contacts-apis)
13. [Analytics & Reports APIs](#analytics--reports-apis)
14. [Webhooks APIs](#webhooks-apis)
15. [API Access Management APIs](#api-access-management-apis)

---

## Authentication

The system supports two authentication methods:

### 1. JWT Bearer Token Authentication
Used for web dashboard and management operations.

**Header:**
```http
Authorization: Bearer <jwt_token>
```

**How it works:**
- User logs in via `/api/auth/login`
- Receives `accessToken` and `refreshToken`
- Use `accessToken` in Authorization header for subsequent requests
- Token expires after configured time (default: 24 hours)
- Use `/api/auth/refresh` to get a new access token

### 2. API Key Authentication (X-API-Key)
Used for programmatic access and external integrations.

**Header:**
```http
X-API-Key: <your_api_key>
```

**How it works:**
- API key is stored in the `businesses` table
- Each business has a unique API key
- API key is validated against the database
- User permissions are checked based on the business associated with the API key
- Used for messaging, usage tracking, and message history endpoints

---

## Authentication APIs

### POST /api/auth/login

**Description:** Authenticate user and receive JWT tokens.

**Authentication:** None required

**Request Body (JSON):**
```json
{
  "email_address": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email_address": "user@example.com",
    "full_name": "John Doe"
  }
}
```

**How it works:**
1. Validates email and password against database
2. Checks if user account is active
3. Generates JWT access token (short-lived)
4. Generates JWT refresh token (long-lived)
5. Returns both tokens and user information

---

### POST /api/auth/register

**Description:** Register a new user account.

**Authentication:** None required

**Request Body (JSON):**
```json
{
  "email_address": "newuser@example.com",
  "password": "password123",
  "full_name": "Jane Doe",
  "business_name": "My Business"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": 2,
    "email_address": "newuser@example.com",
    "full_name": "Jane Doe"
  }
}
```

**How it works:**
1. Validates email format and password strength
2. Checks if email already exists
3. Creates new user account
4. Creates associated business
5. Assigns default permissions and features
6. Returns user information

---

### POST /api/auth/refresh

**Description:** Refresh access token using refresh token.

**Authentication:** None required

**Request Body (JSON):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**How it works:**
1. Validates refresh token signature and expiration
2. Extracts user information from token
3. Generates new access token
4. Optionally generates new refresh token
5. Returns new tokens

---

### GET /api/auth/me

**Description:** Get current authenticated user information with features and permissions.

**Authentication:** JWT Bearer Token required

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "email_address": "user@example.com",
    "full_name": "John Doe",
    "business_id": 1
  },
  "features": [...],
  "permissions": [...]
}
```

**How it works:**
1. Extracts user ID from JWT token
2. Fetches user from database
3. Loads effective features and permissions
4. Returns enriched user object

---

### PATCH /api/auth/me

**Description:** Update current user profile (e.g., timezone, name).

**Authentication:** JWT Bearer Token required

**Request Body (JSON):**
```json
{
  "full_name": "John Updated",
  "timezone": "America/New_York"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {...}
}
```

---

## WhatsApp Connection APIs

All WhatsApp endpoints require JWT authentication and `whatsapp` feature.

### GET /api/whatsapp/status

**Description:** Check WhatsApp connection status for the authenticated user's business.

**Authentication:** JWT Bearer Token + `whatsapp.auth` permission

**Response (200 OK):**
```json
{
  "success": true,
  "whatsapp": {
    "status": "connected",
    "ready": true,
    "initialized": true,
    "authenticated": true
  },
  "account": {
    "id": 1,
    "name": "Demo Account",
    "phone": "1234567890"
  }
}
```

**How it works:**
1. Gets API key from user's business
2. Calls ChatFusion service at `https://be.muraasala.com/api/whatsapp/status`
3. Returns connection status and account information

---

### POST /api/whatsapp/connect

**Description:** Initiate WhatsApp connection. Can connect a specific account by ID.

**Authentication:** JWT Bearer Token + `whatsapp.auth` permission

**Query Parameters (Optional):**
- `account_id`: Account ID to connect (if multiple accounts)

**Request Body (JSON, Optional):**
```json
{
  "accountId": 2
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Connection initiated. Wait a few seconds then get QR code at GET /api/qr?account_id=2",
  "account": {
    "id": 2,
    "status": "pending"
  }
}
```

**How it works:**
1. Gets API key from user's business
2. Calls ChatFusion service at `https://be.muraasala.com/api/account/connect`
3. Sends account_id if provided
4. Returns connection status and next steps

---

### GET /api/whatsapp/qr

**Description:** Get QR code for WhatsApp connection. Call this after connecting an account.

**Authentication:** JWT Bearer Token + `whatsapp.auth` permission

**Query Parameters:**
- `account_id` (required): Account ID to get QR code for

**Response (200 OK):**
```json
{
  "success": true,
  "qr_code": "2@Qu22TT/VS7TGbK5udptd+...",
  "qr_code_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "message": "Scan this QR code with your WhatsApp mobile app",
  "account": {
    "id": 2,
    "name": "Demo Account"
  }
}
```

**How it works:**
1. Gets API key from user's business
2. Calls ChatFusion service at `https://be.muraasala.com/api/qr?account_id=X`
3. Returns QR code string and base64 image
4. Frontend can display the image directly

---

### POST /api/whatsapp/disconnect

**Description:** Disconnect WhatsApp account.

**Authentication:** JWT Bearer Token + `whatsapp.auth` permission

**Request Body (JSON, Optional):**
```json
{
  "accountId": 2
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "WhatsApp disconnected successfully"
}
```

**How it works:**
1. Gets API key from user's business
2. Calls ChatFusion service at `https://be.muraasala.com/api/account/disconnect`
3. Disconnects the specified account or default account

---

### POST /api/whatsapp/check-whatsapp-number

**Description:** Check if a phone number is registered on WhatsApp.

**Authentication:** JWT Bearer Token + `whatsapp.manage` permission

**Request Body (JSON):**
```json
{
  "phoneNumber": "972568085611"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "isWhatsApp": true,
  "phone": "972568085611"
}
```

**How it works:**
1. Gets API key from user's business
2. Calls ChatFusion service at `https://be.muraasala.com/api/whatsapp/check-whatsapp-number?phone=X`
3. Returns whether the number is registered on WhatsApp

---

### GET /api/whatsapp/account-info

**Description:** Get WhatsApp account information.

**Authentication:** JWT Bearer Token + `whatsapp.manage` permission

**Response (200 OK):**
```json
{
  "success": true,
  "account": {
    "id": 1,
    "name": "Demo Account",
    "phone": "1234567890"
  }
}
```

---

### POST /api/whatsapp/update-api-key

**Description:** Update business API key (ChatFusion API key).

**Authentication:** JWT Bearer Token + `whatsapp.manage` permission

**Request Body (JSON):**
```json
{
  "apiKey": "11111111-1111-1111-1111-111111111111",
  "password": "your_password"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "api_key": "11111111-1111-1111-1111-111111111111",
  "message": "API key updated successfully"
}
```

**How it works:**
1. Verifies user password for security
2. Updates `api_key` field in `businesses` table
3. This API key is used for all ChatFusion service calls
4. Returns updated API key

---

### POST /api/whatsapp/reset-api-key

**Description:** Reset business API key (generates new one from ChatFusion).

**Authentication:** JWT Bearer Token + `whatsapp.manage` permission

**Request Body (JSON):**
```json
{
  "password": "your_password"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "apiKey": "new_generated_key_here"
}
```

**How it works:**
1. Verifies user password
2. Calls ChatFusion service to generate new API key
3. Updates database with new key
4. Returns new API key

---

## Messaging APIs

All messaging endpoints support both JWT and API Key authentication. API Key endpoints use form-data format.

### POST /api/messages/send (API Key)

**Description:** Send a single text message to a phone number.

**Authentication:** X-API-Key header

**Request Format:** form-data (multipart/form-data)

**Form Fields:**
- `phone` (required): Phone number (e.g., "972568085611")
- `message` (required): Message text

**Query Parameters (Optional):**
- `account_id`: Account ID to send from

**Response (200 OK):**
```json
{
  "success": true,
  "message_id": 12345,
  "whatsapp_message_id": "3EB0B23C4E5F6A7B8C9D",
  "status": "sent",
  "phone": "972568085611",
  "message": "Hello from WhatsApp API!",
  "account": {
    "id": 1,
    "name": "Demo Account",
    "phone": "1234567890"
  }
}
```

**How it works:**
1. Validates API key and gets business
2. Creates message record in database with status "pending"
3. Calls ChatFusion service at `https://be.muraasala.com/api/messages/send`
4. Sends form-data with `phone` and `message` fields
5. Updates message record with result (sent/failed)
6. Returns message details with WhatsApp message ID

---

### POST /api/messages/send-media (API Key)

**Description:** Send a message with media (image, video, document, audio).

**Authentication:** X-API-Key header

**Request Format:** form-data (multipart/form-data)

**Form Fields:**
- `phone` (required): Phone number
- `message` (optional): Caption text
- `media` (required): File attachment

**Supported Media Types:**
- Images: JPG, PNG, GIF, WebP
- Videos: MP4, AVI, MOV
- Documents: PDF, DOC, DOCX, XLS, XLSX, TXT
- Audio: MP3, WAV, OGG

**Response (200 OK):**
```json
{
  "success": true,
  "message_id": 12346,
  "whatsapp_message_id": "4FA1C34D5E6G7B8H9I0J",
  "status": "sent",
  "phone": "972568085611",
  "message": "Check this image!",
  "media_type": "image/jpeg",
  "account": {
    "id": 1,
    "name": "Demo Account"
  }
}
```

**How it works:**
1. Validates API key and file type
2. Creates message record with media_type
3. Calls ChatFusion service with form-data including file
4. Updates message record with result
5. Returns message details with media information

---

### POST /api/messages/bulk (API Key)

**Description:** Send the same message to multiple phone numbers.

**Authentication:** X-API-Key header

**Request Format:** form-data (multipart/form-data)

**Form Fields:**
- `phones` (required): JSON array as string: `["972568085611", "972595085600"]`
- `message` (required): Message text
- `media` (optional): File attachment

**Response (200 OK):**
```json
{
  "success": true,
  "bulk_message_id": 42,
  "total_recipients": 3,
  "successful": 3,
  "failed": 0,
  "results": [
    {
      "phone": "972568085611",
      "status": "sent",
      "message_id": 12347
    }
  ],
  "account": {
    "id": 1,
    "name": "Demo Account"
  }
}
```

**How it works:**
1. Validates API key and parses phones array
2. Creates message records for each recipient
3. Calls ChatFusion service at `https://be.muraasala.com/api/messages/bulk`
4. Sends to all recipients (with 1-second delay between messages)
5. Updates each message record with individual status
6. Returns bulk statistics and individual results

---

### POST /api/messages/group (API Key)

**Description:** Send message(s) to a WhatsApp group.

**Authentication:** X-API-Key header

**Request Format:** form-data (multipart/form-data)

**Form Fields (Single Message):**
- `groupId` (required): Group ID (e.g., "123456789-1234567890@g.us")
- `message` (required): Message text

**Form Fields (Multiple Messages):**
- `groupId` (required): Group ID
- `messages` (required): JSON array as string: `["Message 1", "Message 2"]`
- `attachments` (optional): Multiple file attachments

**Response (200 OK):**
```json
{
  "success": true,
  "group_id": "123456789-1234567890@g.us",
  "whatsapp_message_id": "8JE5G78H9I0K1F2L3M4N",
  "status": "sent",
  "message": "Hello group members!",
  "account": {
    "id": 1,
    "name": "Demo Account"
  }
}
```

**How it works:**
1. Validates API key and group ID
2. Creates message record(s) for group
3. Calls ChatFusion service at `https://be.muraasala.com/api/messages/group`
4. Sends messages sequentially with 1-second delay
5. Attachments sent with last message
6. Returns group message details

---

### POST /api/messages/send-single (JWT)

**Description:** Send single message (JWT authenticated, for web dashboard).

**Authentication:** JWT Bearer Token

**Request Format:** form-data or JSON

**Request Body:**
```json
{
  "recipient": "972568085611",
  "contents": ["Message text"],
  "files": []
}
```

**How it works:**
- Similar to API Key version but uses JWT authentication
- Supports multiple contents and files
- Used by web dashboard

---

### POST /api/messages/sendBulk (JWT)

**Description:** Send bulk messages (JWT authenticated).

**Authentication:** JWT Bearer Token

**Request Format:** form-data

**Request Body:**
```json
{
  "globalMessages": ["Message text"],
  "recipientsData": [
    {"phone": "972568085611"},
    {"phone": "972595085600"}
  ],
  "globalFiles": []
}
```

---

### POST /api/messages/sendGroup (JWT)

**Description:** Send group message (JWT authenticated).

**Authentication:** JWT Bearer Token

**Request Format:** form-data

**Request Body:**
```json
{
  "groupId": "123456789-1234567890@g.us",
  "contents": ["Message text"],
  "files": []
}
```

---

## Message History APIs

All history endpoints use X-API-Key authentication.

### GET /api/messages

**Description:** Get message history with pagination and filtering.

**Authentication:** X-API-Key header

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50, max: 100)
- `status` (optional): Filter by status (`sent`, `delivered`, `failed`, `pending`)
- `phone` (optional): Filter by phone number (partial match)
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)

**Response (200 OK):**
```json
{
  "success": true,
  "messages": [
    {
      "id": 12345,
      "phone": "972568085611@c.us",
      "message": "Hello!",
      "status": "delivered",
      "whatsapp_message_id": "3EB0B23C4E5F6A7B8C9D",
      "sent_at": "2024-01-20T10:30:00.000Z",
      "delivered_at": "2024-01-20T10:30:05.000Z",
      "failed_at": null,
      "error_message": null
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 25,
    "total_messages": 1250,
    "messages_per_page": 50
  }
}
```

**How it works:**
1. Validates API key and gets business_id
2. Builds database query with filters
3. Queries `Messages` table with pagination
4. Returns messages and pagination metadata

---

### GET /api/messages/status/:status

**Description:** Get messages filtered by status.

**Authentication:** X-API-Key header

**URL Parameters:**
- `status`: One of `sent`, `delivered`, `failed`, `pending`

**Response (200 OK):**
```json
{
  "success": true,
  "status": "failed",
  "count": 15,
  "messages": [
    {
      "id": 12380,
      "phone": "972501234567@c.us",
      "message": "Test message",
      "status": "failed",
      "error_message": "Phone number not registered on WhatsApp",
      "sent_at": "2024-01-20T12:15:00.000Z",
      "failed_at": "2024-01-20T12:15:03.000Z"
    }
  ]
}
```

**How it works:**
1. Validates status value
2. Queries Messages table filtered by status
3. Returns up to 100 messages
4. Sorted by sent_at DESC

---

### GET /api/messages/failed

**Description:** Get all failed messages with error details.

**Authentication:** X-API-Key header

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Messages per page

**Response (200 OK):**
```json
{
  "success": true,
  "failed_messages": [
    {
      "id": 12380,
      "phone": "972501234567@c.us",
      "message": "Test message",
      "error_message": "Phone number not registered on WhatsApp",
      "sent_at": "2024-01-20T12:15:00.000Z",
      "failed_at": "2024-01-20T12:15:03.000Z"
    }
  ],
  "total_failed": 15,
  "pagination": {
    "current_page": 1,
    "total_pages": 1
  }
}
```

**How it works:**
1. Queries Messages table where status = "failed"
2. Includes error_message field
3. Paginated results
4. Sorted by failed_at DESC

---

## Usage Tracking APIs

### GET /api/usage (API Key)

**Description:** Get message usage statistics for the authenticated user.

**Authentication:** X-API-Key header

**Query Parameters:**
- `period` (optional): `today`, `week`, `month`, `all` (default: `all`)
- `startDate` (optional): YYYY-MM-DD
- `endDate` (optional): YYYY-MM-DD

**Response (200 OK):**
```json
{
  "success": true,
  "usage": {
    "total_messages": 1250,
    "sent": 1200,
    "delivered": 1180,
    "failed": 50,
    "pending": 20
  },
  "period": "all",
  "user": {
    "id": 5,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "limits": {
    "has_limits": true,
    "daily_limit": 1000,
    "monthly_limit": 30000,
    "daily_used": 45,
    "monthly_used": 1250,
    "daily_remaining": 955,
    "monthly_remaining": 28750
  }
}
```

**How it works:**
1. Gets user from API key
2. Queries UsageCounter table for message counts
3. Gets usage limits from user's effective features
4. Calculates remaining quotas
5. Returns usage statistics and limits

---

### GET /api/usage/my (JWT)

**Description:** Get current user's usage statistics.

**Authentication:** JWT Bearer Token

**Query Parameters:**
- `feature` (optional): Feature code (default: "bulk_send")
- `period` (optional): `day`, `week`, `month`

**Response (200 OK):**
```json
{
  "feature": "bulk_send",
  "period": "DAY",
  "period_key": "2024-01-20",
  "user": {
    "used": 45,
    "cap": 1000,
    "remaining": 955
  },
  "business": {
    "used": 1250,
    "cap": null,
    "remaining": null
  }
}
```

---

### GET /api/usage/limits/:userId (API Key - Admin)

**Description:** Get usage limits for a specific user (admin only).

**Authentication:** X-API-Key header + Admin role

**Response (200 OK):**
```json
{
  "success": true,
  "limits": {
    "id": 3,
    "user_id": 5,
    "daily_limit": 1000,
    "monthly_limit": 30000,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  "current_usage": {
    "daily_used": 45,
    "monthly_used": 1250,
    "daily_remaining": 955,
    "monthly_remaining": 28750
  },
  "user": {
    "id": 5,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

### POST /api/usage/limits/:userId (API Key - Admin)

**Description:** Set usage limits for a user.

**Authentication:** X-API-Key header + Admin role

**Request Body (JSON):**
```json
{
  "daily_limit": 1000,
  "monthly_limit": 30000
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Usage limits set successfully",
  "limits": {
    "id": 3,
    "user_id": 5,
    "daily_limit": 1000,
    "monthly_limit": 30000,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### PUT /api/usage/limits/:userId (API Key - Admin)

**Description:** Update existing usage limits for a user.

**Authentication:** X-API-Key header + Admin role

**Request Body (JSON):**
```json
{
  "daily_limit": 1500,
  "monthly_limit": 45000
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Usage limits updated successfully",
  "limits": {
    "id": 3,
    "user_id": 5,
    "daily_limit": 1500,
    "monthly_limit": 45000,
    "updated_at": "2024-01-20T14:45:00.000Z"
  }
}
```

---

### DELETE /api/usage/limits/:userId (API Key - Admin)

**Description:** Remove usage limits for a user (unlimited access).

**Authentication:** X-API-Key header + Admin role

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Usage limits removed successfully"
}
```

---

## Customer Management APIs

All customer endpoints require JWT authentication.

### GET /api/customers

**Description:** Get all customers for the authenticated user.

**Authentication:** JWT Bearer Token + `customers.read` permission

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search term

**Response (200 OK):**
```json
{
  "success": true,
  "customers": [
    {
      "id": 1,
      "full_name": "John Doe",
      "whatsapp_number": "972568085611",
      "email": "john@example.com",
      "category_id": 1
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 100
  }
}
```

---

### POST /api/customers

**Description:** Create a new customer.

**Authentication:** JWT Bearer Token + `customers.create` permission

**Request Body (JSON):**
```json
{
  "full_name": "John Doe",
  "whatsapp_number": "972568085611",
  "email": "john@example.com",
  "category_id": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "full_name": "John Doe",
    "whatsapp_number": "972568085611"
  }
}
```

---

### PUT /api/customers/:id

**Description:** Update a customer.

**Authentication:** JWT Bearer Token + `customers.update` permission

**Request Body (JSON):**
```json
{
  "full_name": "John Updated",
  "email": "john.updated@example.com"
}
```

---

### DELETE /api/customers/:id

**Description:** Delete a customer.

**Authentication:** JWT Bearer Token + `customers.delete` permission

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

---

### POST /api/customers/import

**Description:** Import customers from CSV/Excel file.

**Authentication:** JWT Bearer Token + `customers.create` permission

**Request Format:** form-data

**Form Fields:**
- `file` (required): CSV or Excel file
- `category_id` (optional): Default category for imported customers

**Response (200 OK):**
```json
{
  "success": true,
  "imported": 50,
  "failed": 2,
  "errors": [...]
}
```

---

## Scheduled Messages APIs

All schedule endpoints require JWT authentication and `scheduled_messages` feature.

### GET /api/schedules

**Description:** Get all scheduled messages.

**Authentication:** JWT Bearer Token + `schedules.read` permission

**Query Parameters:**
- `status` (optional): Filter by status (`ACTIVE`, `PAUSED`, `CANCELLED`)
- `type` (optional): Filter by type (`ONE_OFF`, `CRON`)

**Response (200 OK):**
```json
{
  "success": true,
  "schedules": [
    {
      "id": "uuid-here",
      "type": "ONE_OFF",
      "status": "ACTIVE",
      "send_at_utc": "2024-01-20T15:00:00.000Z",
      "body": "Scheduled message text"
    }
  ]
}
```

---

### POST /api/schedules

**Description:** Create a new scheduled message.

**Authentication:** JWT Bearer Token + `schedules.create` permission

**Request Format:** form-data

**Form Fields:**
- `type` (required): `ONE_OFF` or `CRON`
- `send_at_utc` (required for ONE_OFF): ISO date string
- `cron_expr` (required for CRON): Cron expression
- `to_number` (optional): Single recipient
- `to_numbers_json` (optional): JSON array of recipients
- `body` (required): Message text
- `files` (optional): File attachments

**Response (201 Created):**
```json
{
  "success": true,
  "schedule": {
    "id": "uuid-here",
    "type": "ONE_OFF",
    "status": "ACTIVE"
  }
}
```

---

### PUT /api/schedules/:id

**Description:** Update a scheduled message.

**Authentication:** JWT Bearer Token + `schedules.update` permission

**Request Body (JSON):**
```json
{
  "status": "PAUSED"
}
```

---

### DELETE /api/schedules/:id

**Description:** Delete a scheduled message.

**Authentication:** JWT Bearer Token + `schedules.delete` permission

---

## Message Templates APIs

### GET /api/message-templates

**Description:** Get all message templates.

**Authentication:** JWT Bearer Token + `templates.read` permission

---

### POST /api/message-templates

**Description:** Create a new message template.

**Authentication:** JWT Bearer Token + `templates.create` permission

**Request Body (JSON):**
```json
{
  "name": "Welcome Template",
  "body": "Hello {name}, welcome to our service!",
  "variables": ["name"]
}
```

---

## User Management APIs

### GET /api/users

**Description:** Get all users (admin only).

**Authentication:** JWT Bearer Token + Admin role

---

### POST /api/users

**Description:** Create a new user (admin only).

**Authentication:** JWT Bearer Token + Admin role

---

## Business Management APIs

### GET /api/businesses

**Description:** Get all businesses (admin only).

**Authentication:** JWT Bearer Token + Admin role

---

### GET /api/businesses/:id

**Description:** Get business details.

**Authentication:** JWT Bearer Token

---

## Groups & Contacts APIs

### GET /api/group/get-groups

**Description:** Get all WhatsApp groups.

**Authentication:** JWT Bearer Token

**Response (200 OK):**
```json
{
  "success": true,
  "groups": [
    {
      "id": {
        "_serialized": "120363123456789012@g.us"
      },
      "name": "Family Group",
      "participantsCount": 10
    }
  ]
}
```

---

## Analytics & Reports APIs

### GET /api/analytics/overview

**Description:** Get analytics overview.

**Authentication:** JWT Bearer Token

---

### GET /api/history

**Description:** Get message history reports.

**Authentication:** JWT Bearer Token

---

## Webhooks APIs

### POST /api/webhooks

**Description:** Create a webhook.

**Authentication:** JWT Bearer Token

**Request Body (JSON):**
```json
{
  "url": "https://example.com/webhook",
  "events": ["message.sent", "message.delivered"]
}
```

---

### GET /api/webhooks

**Description:** Get all webhooks.

**Authentication:** JWT Bearer Token

---

## API Access Management APIs

### GET /api/api-access

**Description:** Get API access settings.

**Authentication:** JWT Bearer Token

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error message here",
  "details": "Additional details (optional)"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Rate Limiting

- **Per User**: Based on usage limits set by admin
- **Per API Key**: Unlimited (controlled by user limits)
- **Bulk Messages**: 1-second delay between recipients
- **Group Messages**: 1-second delay between messages

---

## Database Schema

### Messages Table

Stores all sent messages for history tracking:

- `id`: Auto-increment primary key
- `business_id`: Business identifier
- `user_id`: User who sent the message
- `phone`: Recipient phone number
- `message`: Message text content
- `status`: Message status (sent, delivered, failed, pending)
- `whatsapp_message_id`: WhatsApp's message ID
- `media_type`: MIME type for media messages
- `message_type`: Type (single, bulk, group)
- `error_message`: Error details if failed
- `sent_at`, `delivered_at`, `failed_at`: Timestamps

---

## Integration Flow

### How Messaging Works

1. **Client Request** → Backend API (with X-API-Key)
2. **Backend Validates** → API key, permissions, usage limits
3. **Backend Creates** → Message record in database
4. **Backend Calls** → ChatFusion service at `https://be.muraasala.com`
5. **ChatFusion Sends** → Message via WhatsApp
6. **Backend Updates** → Message record with result
7. **Backend Returns** → Response to client

### How Authentication Works

**JWT Flow:**
1. User logs in → Receives accessToken and refreshToken
2. Client stores tokens → Uses accessToken in Authorization header
3. Backend validates → JWT signature and expiration
4. Backend extracts → User ID and permissions
5. Request processed → With user context

**API Key Flow:**
1. Client sends request → With X-API-Key header
2. Backend looks up → Business by API key
3. Backend gets → Associated user and permissions
4. Request processed → With business context

---

## Best Practices

1. **Error Handling**: Always check the `success` field in responses
2. **Rate Limiting**: Respect usage limits and implement retry logic
3. **Bulk Operations**: Use 1-second delays between messages
4. **Phone Format**: Phone numbers can be with or without country code
5. **Date Ranges**: Use YYYY-MM-DD format for date filters
6. **Pagination**: Implement proper pagination for large datasets
7. **Media Files**: Keep media files under 25MB
8. **Token Storage**: Store JWT tokens securely (not in localStorage for production)
9. **API Key Security**: Never expose API keys in client-side code

---

## Environment Configuration

All ChatFusion service URLs are configured in environment files:

```env
CHATFUSION_BASE_URL=https://be.muraasala.com
CHATFUSION_MESSAGING_SEND_URL=https://be.muraasala.com/api/messages/send
CHATFUSION_WHATSAPP_STATUS_URL=https://be.muraasala.com/api/whatsapp/status
```

---

**Last Updated:** November 2025  
**Version:** 2.0  
**API Base:** https://be.muraasala.com

