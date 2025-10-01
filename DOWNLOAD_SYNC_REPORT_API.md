# Download Sync Report API Documentation

## Overview
This API endpoint allows you to download the WhatsApp sync report as an Excel or CSV file. The report contains details about contacts processed during the sync operation, including phone numbers, names, and verified names from WhatsApp contacts that meet specific filtering criteria.

## Endpoint Details

**URL:** `GET /api/customers/sync-report`  
**Method:** `GET`  
**Authentication:** Required (Bearer JWT token)  
**Permission:** `customers.create`  
**Content-Type:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (Excel) or `text/csv` (CSV)

## Request Payload

### Headers
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Query Parameters
| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| `lang` | string | No | `"en"` | Language for status messages | `"en"` or `"ar"` |
| `format` | string | No | `"excel"` | Report format | `"excel"` or `"csv"` |

### Example Request
```bash
GET /api/customers/sync-report?lang=en&format=excel
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Response Structure

### Success Response (200) - Excel Format
```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="whatsapp_sync_report.xlsx"
Content-Length: 12345

[Binary Excel file content]
```

### Success Response (200) - CSV Format
```http
HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="whatsapp_sync_report.csv"
Content-Length: 1234

Phone Number,Name,Verified Name
+1234567890,John Doe,John's Business
+0987654321,Jane Smith,
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

### Error Response (500) - WhatsApp API Error
```json
{
  "error": "WhatsApp Contacts Error: Unauthorized - Invalid API key or expired credentials"
}
```

### Error Response (500) - Service Error
```json
{
  "error": "WhatsApp Contacts Error: Service not found - ChatFusion API endpoint unavailable"
}
```

### Error Response (500) - Network Error
```json
{
  "error": "WhatsApp Contacts Error: Cannot connect to ChatFusion API - Network or DNS issue"
}
```

## Report Content

### Excel/CSV File Structure
| Column | Description | Example |
|--------|-------------|---------|
| **Phone Number** | WhatsApp number processed | `"+1234567890"` |
| **Name** | Final name used (verified name preferred) | `"John's Business"` |
| **Verified Name** | Original verified name from WhatsApp | `"John's Business"` |

### Contact Filtering Criteria
The API only processes contacts that meet ALL of the following criteria:
- `isUser: true` - Contact is a user
- `isMe: false` - Contact is not the current user
- `isWAContact: true` - Contact is a WhatsApp contact
- `isBlocked: false` - Contact is not blocked

### Data Processing Logic
1. **Fetches** WhatsApp contacts from ChatFusion API
2. **Filters** contacts based on the criteria above
3. **Extracts** phone numbers and names from filtered contacts
4. **Prioritizes** verified names over regular names when available
5. **Creates** new customers in the database
6. **Generates** Excel/CSV report with processing results

## Usage Examples

### cURL - Excel Download
```bash
curl -X GET "http://localhost:5550/api/customers/sync-report?lang=en&format=excel" \
  -H "Authorization: Bearer your_jwt_token" \
  -o whatsapp_sync_report.xlsx
```

### cURL - CSV Download
```bash
curl -X GET "http://localhost:5550/api/customers/sync-report?lang=en&format=csv" \
  -H "Authorization: Bearer your_jwt_token" \
  -o whatsapp_sync_report.csv
```

### JavaScript - Excel Download
```javascript
const response = await fetch('/api/customers/sync-report?lang=en&format=excel', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_jwt_token'
  }
});

if (response.ok) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'whatsapp_sync_report.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
} else {
  const error = await response.json();
  console.error('Error:', error);
}
```

### JavaScript - CSV Download
```javascript
const response = await fetch('/api/customers/sync-report?lang=en&format=csv', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_jwt_token'
  }
});

if (response.ok) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'whatsapp_sync_report.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}
```

### Python - Excel Download
```python
import requests

url = 'http://localhost:5550/api/customers/sync-report'
headers = {
    'Authorization': 'Bearer your_jwt_token'
}
params = {
    'lang': 'en',
    'format': 'excel'
}

response = requests.get(url, headers=headers, params=params)

if response.status_code == 200:
    with open('whatsapp_sync_report.xlsx', 'wb') as f:
        f.write(response.content)
    print("Report downloaded successfully")
else:
    print(f"Error: {response.json()}")
```

### Python - CSV Download
```python
import requests

url = 'http://localhost:5550/api/customers/sync-report'
headers = {
    'Authorization': 'Bearer your_jwt_token'
}
params = {
    'lang': 'en',
    'format': 'csv'
}

response = requests.get(url, headers=headers, params=params)

if response.status_code == 200:
    with open('whatsapp_sync_report.csv', 'wb') as f:
        f.write(response.content)
    print("Report downloaded successfully")
else:
    print(f"Error: {response.json()}")
```

## Alternative: JSON Response with Base64 Report

If you prefer to receive the report as a JSON response with base64 encoded content, use the main sync endpoint:

### Endpoint: `GET /api/customers/sync-whatsapp-contacts`

#### Response Structure
```json
{
  "success": true,
  "message": "WhatsApp contacts synced successfully",
  "summary": {
    "total": 150,
    "added": 45,
    "skipped": 100,
    "errors": 5
  },
  "reportBuffer": "UEsDBBQAAAAIAA...", // Base64 encoded Excel report
  "note": "These are your WhatsApp contacts from the connected account"
}
```

#### JavaScript Example - Base64 to File
```javascript
const response = await fetch('/api/customers/sync-whatsapp-contacts?lang=en', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_jwt_token'
  }
});

const result = await response.json();
if (result.success) {
  // Convert base64 to blob and download
  const reportBuffer = result.reportBuffer;
  const binaryString = atob(reportBuffer);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'whatsapp_sync_report.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
}
```

## Key Features

✅ **Filtered Contacts**: Only processes contacts matching specific criteria  
✅ **Verified Names**: Prioritizes verified business names over regular names  
✅ **Multiple Formats**: Excel (.xlsx) and CSV (.csv) support  
✅ **Language Support**: English and Arabic status messages  
✅ **Error Handling**: Comprehensive error responses  
✅ **Authentication**: JWT-based security  
✅ **Permission Control**: Requires `customers.create` permission  
✅ **Database Integration**: Automatically creates new customers  
✅ **Report Generation**: Detailed Excel/CSV reports with processing results  

## Implementation Notes

### File Formats
1. **Excel (.xlsx)**: Default format, includes formatting and data validation
2. **CSV (.csv)**: Plain text format, easier to process programmatically

### Language Support
- **English (`"en"`)**: Default language for status messages
- **Arabic (`"ar"`)**: Arabic translations for status messages

### Authentication Requirements
- Valid JWT token required
- User must have `customers.create` permission
- Business must have valid ChatFusion API key

### Error Handling
- **401 Unauthorized**: Invalid or missing authentication token
- **403 Forbidden**: User lacks required permissions
- **500 Server Error**: ChatFusion API issues or processing errors

## Related Endpoints

- `GET /api/customers/sync-whatsapp-contacts` - Sync and get JSON response with base64 report
- `POST /api/customers/import` - Import customers from Excel file
- `GET /api/customers/import-template` - Download import template
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create single customer

## Report Generation Process

1. **Contact Retrieval**: Fetches contacts from ChatFusion WhatsApp API
2. **Filtering**: Applies criteria (isUser=true, isMe=false, isWAContact=true, isBlocked=false)
3. **Data Extraction**: Extracts phone numbers and names (prioritizing verified names)
4. **Database Operations**: Creates new customers for valid contacts
5. **Report Generation**: Creates Excel/CSV file with processing results
6. **File Delivery**: Returns file as download or base64 encoded content

## File Naming Convention

- **Excel**: `whatsapp_sync_report.xlsx`
- **CSV**: `whatsapp_sync_report.csv`
- **Timestamp**: Files can include timestamp for uniqueness (e.g., `whatsapp_sync_report_2025-01-01.xlsx`)

## Contact Filtering Logic

The API implements strict filtering to ensure only relevant contacts are processed:

```javascript
const filteredContacts = contacts.filter(contact => {
  return contact.isUser === true && 
         contact.isMe === false && 
         contact.isWAContact === true && 
         contact.isBlocked === false;
});
```

This ensures that:
- Only actual users are processed (not groups or system contacts)
- The current user's own contact is excluded
- Only WhatsApp contacts are included
- Blocked contacts are excluded from processing

## Data Processing Flow

1. **API Call**: Fetches contacts from ChatFusion WhatsApp API
2. **Response Parsing**: Extracts contacts from nested response structure
3. **Filtering**: Applies the filtering criteria above
4. **Data Extraction**: Extracts phone numbers and names
5. **Name Prioritization**: Uses verified names when available, falls back to regular names
6. **Database Check**: Checks for existing customers
7. **Customer Creation**: Creates new customers for valid contacts
8. **Report Generation**: Creates Excel/CSV report with all processing results
