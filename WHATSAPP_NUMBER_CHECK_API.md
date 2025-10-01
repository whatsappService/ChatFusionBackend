# WhatsApp Number Check API Documentation

## Overview
This API endpoint allows you to check if a phone number is registered on WhatsApp using the ChatFusion service.

## Endpoint Details

**URL:** `POST /api/whatsapp/check-whatsapp-number`  
**Method:** `POST`  
**Authentication:** Required (Bearer token + API key)  
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
  "phoneNumber": "+1234567890"
}
```

### Request Parameters
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `phoneNumber` | string | Yes | Phone number to check (with country code) | `"+1234567890"` |

## Response Structure

### Success Response (200) - Number is Registered
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

### Success Response (200) - Number is Not Registered
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

### Error Response (400) - Missing Phone Number
```json
{
  "success": false,
  "message": "Phone number is required"
}
```

### Error Response (400) - WhatsApp Not Connected
```json
{
  "success": false,
  "error": "WhatsApp Number Check Controller Error",
  "message": "WhatsApp is not connected. Please scan the QR code to connect.",
  "source": "WhatsApp Controller"
}
```

### Error Response (401) - Invalid API Key
```json
{
  "success": false,
  "error": "WhatsApp Number Check Controller Error",
  "message": "Invalid API key - Please check your API key and try again",
  "source": "WhatsApp Controller"
}
```

### Error Response (401) - Unauthorized
```json
{
  "success": false,
  "error": "WhatsApp Number Check Controller Error",
  "message": "WhatsApp Number Check Error: Unauthorized - Invalid API key or expired credentials",
  "source": "WhatsApp Controller"
}
```

### Error Response (404) - Service Not Found
```json
{
  "success": false,
  "error": "WhatsApp Number Check Controller Error",
  "message": "WhatsApp Number Check Error: Service not found - ChatFusion API endpoint unavailable",
  "source": "WhatsApp Controller"
}
```

### Error Response (500) - Server Error
```json
{
  "success": false,
  "error": "WhatsApp Number Check Controller Error",
  "message": "WhatsApp Number Check Error: ChatFusion server error - External service is down",
  "source": "WhatsApp Controller"
}
```

## Response Fields

### Success Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the request was successful |
| `status` | string | Status of the phone number check |
| `statusCode` | number | HTTP status code |
| `message` | string | Human-readable message |
| `data.phoneNumber` | string | The phone number that was checked |
| `data.registered` | boolean | Whether the number is registered on WhatsApp |
| `data.status` | string | Registration status (`"registered"` or `"not_registered"`) |
| `data.whatsappId` | string | WhatsApp ID (only present if registered) |
| `data.contactName` | string | Contact name (only present if registered) |
| `data.message` | string | Additional message (only present if not registered) |

### Error Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` for errors |
| `error` | string | Error type identifier |
| `message` | string | Human-readable error message |
| `source` | string | Source of the error (e.g., "WhatsApp Controller") |

## Usage Examples

### cURL Example
```bash
curl -X POST http://localhost:5550/api/whatsapp/check-whatsapp-number \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890"
  }'
```

### JavaScript Example
```javascript
const response = await fetch('/api/whatsapp/check-whatsapp-number', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phoneNumber: '+1234567890'
  })
});

const result = await response.json();
console.log(result);
```

### Python Example
```python
import requests

url = 'http://localhost:5550/api/whatsapp/check-whatsapp-number'
headers = {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
}
data = {
    'phoneNumber': '+1234567890'
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)
```

## Implementation Notes

1. **Authentication Required**: This endpoint requires both JWT authentication and a valid API key for the ChatFusion service.

2. **Phone Number Format**: Phone numbers should include the country code (e.g., `+1234567890`).

3. **Rate Limiting**: The endpoint may be subject to rate limiting based on your ChatFusion API plan.

4. **WhatsApp Connection**: The ChatFusion service must be connected to WhatsApp for this endpoint to work properly.

5. **Error Handling**: The endpoint provides detailed error messages to help with troubleshooting.

## Related Endpoints

- `GET /api/whatsapp/status` - Check WhatsApp connection status
- `GET /api/whatsapp/connect` - Connect to WhatsApp (get QR code)
- `POST /api/whatsapp/disconnect` - Disconnect from WhatsApp
- `POST /api/messages/send-single` - Send a single message
- `POST /api/messages/sendBulk` - Send bulk messages
