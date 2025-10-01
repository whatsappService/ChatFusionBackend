# Status API Documentation

## WhatsApp Status API

### Get WhatsApp Connection Status

**Endpoint:** `GET /api/whatsapp/status`

**Description:** Retrieves the current WhatsApp connection status for the authenticated user's business.

**Authentication:** Required (Bearer Token)

**Permissions:** `whatsapp.auth`

---

## Request

### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Query Parameters
None

---

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "connected": true,
  "phoneNumber": "+1234567890",
  "businessName": "My Business",
  "qrCode": null,
  "lastSeen": "2025-09-30T10:30:00Z",
  "status": "connected",
  "message": "WhatsApp is connected and ready"
}
```

### Success Response - Not Connected (200 OK)

```json
{
  "success": true,
  "connected": false,
  "phoneNumber": null,
  "businessName": "My Business",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "lastSeen": null,
  "status": "disconnected",
  "message": "WhatsApp is not connected. Please scan QR code to connect."
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

#### 400 Bad Request - API Key Not Found
```json
{
  "error": "WhatsApp Status Controller Error",
  "message": "API Key not found.",
  "source": "WhatsApp Controller"
}
```

#### 400 Bad Request - Invalid API Key
```json
{
  "error": "WhatsApp Status Controller Error",
  "message": "WhatsApp Status Error: Unauthorized - Invalid API key or expired credentials",
  "source": "WhatsApp Controller"
}
```

#### 404 Not Found - Service Unavailable
```json
{
  "error": "WhatsApp Status Controller Error",
  "message": "WhatsApp Status Error: Service not found - ChatFusion API endpoint unavailable",
  "source": "WhatsApp Controller"
}
```

#### 500 Internal Server Error
```json
{
  "error": "WhatsApp Status Controller Error",
  "message": "WhatsApp Status Error: ChatFusion server error - External service is down",
  "source": "WhatsApp Controller"
}
```

#### 500 Internal Server Error - Network Issue
```json
{
  "error": "WhatsApp Status Controller Error",
  "message": "WhatsApp Status Error: Cannot connect to ChatFusion API - Network or DNS issue",
  "source": "WhatsApp Controller"
}
```

---

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the request was successful |
| `connected` | boolean | Whether WhatsApp is currently connected |
| `phoneNumber` | string\|null | The connected WhatsApp phone number (if connected) |
| `businessName` | string | The business name associated with the account |
| `qrCode` | string\|null | Base64 encoded QR code image (if not connected) |
| `lastSeen` | string\|null | ISO 8601 timestamp of last connection activity |
| `status` | string | Connection status: "connected", "disconnected", "connecting" |
| `message` | string | Human-readable status message |

---

## Usage Examples

### cURL
```bash
curl -X GET "http://localhost:5550/api/whatsapp/status" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### JavaScript (Fetch)
```javascript
const response = await fetch('http://localhost:5550/api/whatsapp/status', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  }
});

const status = await response.json();
console.log('WhatsApp Status:', status);
```

### JavaScript (Axios)
```javascript
const axios = require('axios');

const response = await axios.get('http://localhost:5550/api/whatsapp/status', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  }
});

console.log('WhatsApp Status:', response.data);
```

### Python
```python
import requests

headers = {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
}

response = requests.get('http://localhost:5550/api/whatsapp/status', headers=headers)
status = response.json()
print('WhatsApp Status:', status)
```

### PHP
```php
<?php
$url = 'http://localhost:5550/api/whatsapp/status';
$headers = [
    'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type: application/json'
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$status = json_decode($response, true);
curl_close($ch);

echo 'WhatsApp Status: ' . json_encode($status);
?>
```

---

## Integration Examples

### React Component
```jsx
import React, { useState, useEffect } from 'react';

const WhatsAppStatus = ({ token }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/whatsapp/status', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Error fetching WhatsApp status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [token]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="whatsapp-status">
      <h3>WhatsApp Status</h3>
      <p>Status: {status?.connected ? 'Connected' : 'Disconnected'}</p>
      {status?.phoneNumber && <p>Phone: {status.phoneNumber}</p>}
      {status?.qrCode && (
        <div>
          <p>Scan QR Code to connect:</p>
          <img src={status.qrCode} alt="WhatsApp QR Code" />
        </div>
      )}
    </div>
  );
};

export default WhatsAppStatus;
```

### Vue.js Component
```vue
<template>
  <div class="whatsapp-status">
    <h3>WhatsApp Status</h3>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <p>Status: {{ status?.connected ? 'Connected' : 'Disconnected' }}</p>
      <p v-if="status?.phoneNumber">Phone: {{ status.phoneNumber }}</p>
      <div v-if="status?.qrCode">
        <p>Scan QR Code to connect:</p>
        <img :src="status.qrCode" alt="WhatsApp QR Code" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      status: null,
      loading: true
    };
  },
  async mounted() {
    try {
      const response = await fetch('/api/whatsapp/status', {
        headers: {
          'Authorization': `Bearer ${this.$store.state.token}`,
          'Content-Type': 'application/json'
        }
      });
      this.status = await response.json();
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
    } finally {
      this.loading = false;
    }
  }
};
</script>
```

---

## Key Features

- **Real-time Status**: Get current WhatsApp connection status
- **QR Code Generation**: Automatically generates QR codes for connection
- **Phone Number Display**: Shows connected WhatsApp phone number
- **Business Context**: Displays business information
- **Error Handling**: Comprehensive error responses for different scenarios
- **Security**: Requires authentication and proper API key validation

---

## Implementation Notes

1. **Authentication Required**: All requests must include a valid JWT token
2. **API Key Validation**: The endpoint validates the business API key with the WhatsApp service
3. **Real-time Data**: Status information is fetched from the external WhatsApp service
4. **Error Handling**: Comprehensive error handling for network, authentication, and service issues
5. **QR Code Format**: QR codes are returned as base64-encoded PNG images
6. **Timezone Support**: All timestamps are in UTC format

---

## Testing

### Test Connected Status
```bash
# Test with valid token
curl -X GET "http://localhost:5550/api/whatsapp/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -v
```

### Test Error Handling
```bash
# Test with invalid token
curl -X GET "http://localhost:5550/api/whatsapp/status" \
  -H "Authorization: Bearer invalid_token" \
  -v
```

### Expected Responses
- **200 OK**: When WhatsApp is connected or disconnected (both are valid states)
- **401 Unauthorized**: When token is invalid or expired
- **400 Bad Request**: When API key is missing or invalid
- **404 Not Found**: When WhatsApp service is unavailable
- **500 Internal Server Error**: When there are server-side issues

---

## Rate Limiting

This endpoint is subject to the same rate limiting as other API endpoints:
- **Limit**: 1000 requests per 15 minutes
- **Headers**: Rate limit information is included in response headers
- **Exceeded**: Returns 429 Too Many Requests when limit is exceeded

---

## Security Considerations

1. **Token Validation**: All requests are validated against the JWT token
2. **Business Isolation**: Users can only access their own business WhatsApp status
3. **API Key Security**: API keys are validated with the external WhatsApp service
4. **Error Information**: Error messages don't expose sensitive system information
5. **CORS Support**: Proper CORS headers for cross-origin requests
