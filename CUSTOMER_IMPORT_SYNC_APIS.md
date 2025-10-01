# Customer Import, Sync, and Template APIs Documentation

## Overview
This document covers three related APIs for customer management:
1. **Excel Import** - Import customers from an Excel file
2. **WhatsApp Sync** - Sync customers with WhatsApp contacts
3. **Template Download** - Download Excel import template

---

## 1. Excel Import API

### Endpoint Details
**URL:** `POST /api/customers/import`  
**Method:** `POST`  
**Authentication:** Required (Bearer token)  
**Content-Type:** `multipart/form-data`

### Request Payload

#### Headers
```
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data
```

#### Form Data
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `file` | File | **Yes** | Excel file (.xlsx) with customer data | Excel file |
| `lang` | string | No | Language for status messages | `"en"` or `"ar"` |

#### Excel File Format
The Excel file should have the following columns in the first row:
| Column | Description | Example | Required |
|--------|-------------|---------|----------|
| **Customer Name** | Customer's display name | `"John Doe"` | No |
| **Phone Number** | WhatsApp number (with country code) | `"+1234567890"` | **Yes** |
| **Gender** | Customer's gender | `"male"`, `"female"`, `"notSet"` | No |
| **Category** | Customer category name | `"VIP"`, `"Regular"` | No |

### Response Structure

#### Success Response (200) - Excel Report Download
**Content-Type:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`  
**Content-Disposition:** `attachment; filename="import_report.xlsx"`

The response is an Excel file containing:
- Original data from your import file
- **Status** column with processing results
- Status values: `"addedSuccessfully"`, `"missingPhone"`, `"notRegistered"`, `"alreadyExists"`, `"error: {message}"`

#### Error Response (400) - Missing File
```json
{
  "error": "No file uploaded"
}
```

#### Error Response (500) - Processing Error
```json
{
  "error": "Failed to process Excel file"
}
```

### Usage Examples

#### cURL Example
```bash
curl -X POST http://localhost:5550/api/customers/import \
  -H "Authorization: Bearer your_jwt_token" \
  -F "file=@customers.xlsx" \
  -F "lang=en"
```

#### JavaScript Example
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('lang', 'en');

const response = await fetch('/api/customers/import', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token'
  },
  body: formData
});

if (response.ok) {
  const blob = await response.blob();
  // Handle the Excel report download
}
```

---

## 2. WhatsApp Sync API

### Endpoint Details
**URL:** `GET /api/customers/sync-whatsapp-contacts`  
**Method:** `GET`  
**Authentication:** Required (Bearer token)  
**Content-Type:** `application/json`

### Request Payload

#### Headers
```
Authorization: Bearer {jwt_token}
```

#### Query Parameters
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `lang` | string | No | Language for status messages | `"en"` or `"ar"` |

### Response Structure

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "reportBuffer": "UEsDBBQAAAAIAA...", // Base64 encoded Excel report
    "summary": {
      "total": 150,
      "added": 45,
      "skipped": 100,
      "errors": 5
    }
  }
}
```

#### Error Response (401) - Invalid API Key
```json
{
  "error": "WhatsApp Contacts Error: Unauthorized - Invalid API key or expired credentials"
}
```

#### Error Response (404) - Service Not Found
```json
{
  "error": "WhatsApp Contacts Error: Service not found - ChatFusion API endpoint unavailable"
}
```

#### Error Response (500) - Server Error
```json
{
  "error": "WhatsApp Contacts Error: ChatFusion server error - External service is down"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the sync was successful |
| `data.reportBuffer` | string | Base64 encoded Excel report file |
| `data.summary.total` | integer | Total contacts processed |
| `data.summary.added` | integer | New customers added |
| `data.summary.skipped` | integer | Contacts skipped (already exist) |
| `data.summary.errors` | integer | Contacts that failed to process |

### Usage Examples

#### cURL Example
```bash
curl -X GET "http://localhost:5550/api/customers/sync-whatsapp-contacts?lang=en" \
  -H "Authorization: Bearer your_jwt_token"
```

#### JavaScript Example
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
  const reportBuffer = result.data.reportBuffer;
  const binaryString = atob(reportBuffer);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  // Download the file
}
```

---

## 3. Template Download API

### Endpoint Details
**URL:** `GET /api/customers/import-template`  
**Method:** `GET`  
**Authentication:** Required (Bearer token)  
**Content-Type:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### Request Payload

#### Headers
```
Authorization: Bearer {jwt_token}
```

#### Query Parameters
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `lang` | string | No | Language for template headers | `"en"` or `"ar"` |

### Response Structure

#### Success Response (200) - Excel Template Download
**Content-Type:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`  
**Content-Disposition:** `attachment; filename="customer_import_template.xlsx"`

The response is an Excel file containing:
- **Header row** with column names
- **Sample data row** with examples
- **Data validation** for gender and category fields
- **Instructions** for proper formatting

#### Template Structure
| Column | Description | Example | Validation |
|--------|-------------|---------|------------|
| **Customer Name** | Customer's display name | `"John Doe"` | Free text |
| **Phone Number** | WhatsApp number | `"+1234567890"` | Must include country code |
| **Gender** | Customer's gender | `"male"`, `"female"`, `"notSet"` | Dropdown validation |
| **Category** | Customer category | `"VIP"`, `"Regular"` | Dropdown with user's categories |

#### Error Response (500) - Template Generation Error
```json
{
  "error": "Failed to generate template"
}
```

### Usage Examples

#### cURL Example
```bash
curl -X GET "http://localhost:5550/api/customers/import-template?lang=en" \
  -H "Authorization: Bearer your_jwt_token" \
  -o customer_import_template.xlsx
```

#### JavaScript Example
```javascript
const response = await fetch('/api/customers/import-template?lang=en', {
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
  a.download = 'customer_import_template.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
}
```

---

## Common Status Messages

### Import/Sync Status Values
| Status | Description |
|--------|-------------|
| `"addedSuccessfully"` | Customer was successfully added |
| `"missingPhone"` | Phone number was missing or empty |
| `"notRegistered"` | Phone number is not registered on WhatsApp |
| `"alreadyExists"` | Customer with this phone number already exists |
| `"error: {message}"` | Processing failed with specific error |

### Language Support
- **English (`"en"`)**: Default language
- **Arabic (`"ar"`)**: Arabic translations for status messages

---

## Implementation Notes

### Excel Import
1. **File Format**: Only `.xlsx` files are supported
2. **Validation**: Phone numbers are validated via WhatsApp API
3. **Categories**: Must match existing user categories or use default
4. **Gender**: Normalized to `"male"`, `"female"`, or `"not_set"`
5. **Report**: Always returns an Excel file with processing results

### WhatsApp Sync
1. **API Key Required**: User's business must have a valid ChatFusion API key
2. **WhatsApp Connection**: ChatFusion service must be connected to WhatsApp
3. **Contact Processing**: Each contact is validated and processed individually
4. **Report Generation**: Always returns an Excel report with sync results

### Template Download
1. **User Categories**: Template includes user's existing categories
2. **Data Validation**: Excel file includes dropdown validation
3. **Language Support**: Headers and instructions in selected language
4. **Sample Data**: Includes example row for reference

---

## Related Endpoints

- `POST /api/customers` - Create single customer
- `GET /api/customers` - Get all customers
- `GET /api/customers/categories` - Get customer categories
- `POST /api/customers/categories` - Create customer category
- `POST /api/whatsapp/check-whatsapp-number` - Check WhatsApp number
