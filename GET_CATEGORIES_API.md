# Get Categories API Documentation

## Overview
This API provides comprehensive category management with advanced filtering, search, and pagination capabilities. It supports multiple query parameters for flexible data retrieval.

## Endpoint Details

### **Primary Endpoint**
- **URL:** `GET /api/customers/categories/paginated`
- **Method:** `GET`
- **Authentication:** Required (Bearer JWT token)
- **Permission:** `categories.read`
- **Content-Type:** `application/json`

### **Alternative Simple Endpoint**
- **URL:** `GET /api/customers/categories`
- **Method:** `GET`
- **Description:** Returns all categories without pagination (for dropdowns, etc.)

---

## Request Specification

### **Headers**
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
Accept: application/json
```

### **Query Parameters**

| Parameter | Type | Required | Default | Description | Validation |
|-----------|------|----------|---------|-------------|------------|
| `page` | integer | No | `0` | Page number (0-based indexing) | `>= 0` |
| `limit` | integer | No | `10` | Items per page | `1-100` |
| `search` | string | No | `""` | Search term for category name | Case-insensitive, trimmed |
| `sortBy` | string | No | `"name"` | Sort field | `name`, `createdAt`, `updatedAt` |
| `sortOrder` | string | No | `"asc"` | Sort direction | `asc`, `desc` |

### **Request Examples**

#### **Basic Pagination**
```bash
GET /api/customers/categories/paginated?page=0&limit=10
```

#### **Search with Pagination**
```bash
GET /api/customers/categories/paginated?search=VIP&page=0&limit=5
```

#### **Sort by Creation Date (Newest First)**
```bash
GET /api/customers/categories/paginated?sortBy=createdAt&sortOrder=desc
```

#### **Advanced Search with All Parameters**
```bash
GET /api/customers/categories/paginated?search=customer&page=1&limit=20&sortBy=name&sortOrder=asc
```

#### **cURL Examples**
```bash
# Basic request
curl -X GET "http://localhost:5550/api/customers/categories/paginated?page=0&limit=10" \
  -H "Authorization: Bearer your_jwt_token"

# Search request
curl -X GET "http://localhost:5550/api/customers/categories/paginated?search=VIP&page=0&limit=5" \
  -H "Authorization: Bearer your_jwt_token"

# Sort request
curl -X GET "http://localhost:5550/api/customers/categories/paginated?sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer your_jwt_token"
```

---

## Response Specification

### **Success Response (200 OK)**

#### **Response Structure**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "VIP Customers",
      "user_id": 123,
      "createdAt": "2025-01-01T10:00:00.000Z",
      "updatedAt": "2025-01-01T10:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Regular Customers",
      "user_id": 123,
      "createdAt": "2025-01-01T11:00:00.000Z",
      "updatedAt": "2025-01-01T11:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 0,
    "totalPages": 3,
    "totalItems": 25,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 1,
    "prevPage": null
  },
  "search": {
    "term": "VIP",
    "results": 2
  }
}
```

#### **Field Descriptions**

**Category Object:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique category identifier |
| `name` | string | Category name |
| `user_id` | integer | Owner user ID |
| `createdAt` | string | ISO 8601 creation timestamp |
| `updatedAt` | string | ISO 8601 last update timestamp |

**Pagination Object:**
| Field | Type | Description |
|-------|------|-------------|
| `currentPage` | integer | Current page number (0-based) |
| `totalPages` | integer | Total number of pages |
| `totalItems` | integer | Total number of categories |
| `itemsPerPage` | integer | Number of items per page |
| `hasNextPage` | boolean | Whether there's a next page |
| `hasPrevPage` | boolean | Whether there's a previous page |
| `nextPage` | integer\|null | Next page number or null |
| `prevPage` | integer\|null | Previous page number or null |

**Search Object:**
| Field | Type | Description |
|-------|------|-------------|
| `term` | string | Search term used |
| `results` | integer | Number of results found |

---

## Error Responses

### **400 Bad Request - Invalid Parameters**
```json
{
  "success": false,
  "message": "Invalid request parameters",
  "error": "invalid_parameters",
  "details": {
    "page": "Must be >= 0",
    "limit": "Must be between 1 and 100"
  }
}
```

### **401 Unauthorized - Missing/Invalid Token**
```json
{
  "success": false,
  "message": "Authentication required",
  "error": "unauthorized"
}
```

### **403 Forbidden - Insufficient Permissions**
```json
{
  "success": false,
  "message": "Permission denied - categories.read required",
  "error": "permission_denied",
  "required": ["categories.read"],
  "mode": "any"
}
```

### **404 Not Found - No Categories**
```json
{
  "success": false,
  "message": "No categories found",
  "error": "not_found"
}
```

### **500 Internal Server Error**
```json
{
  "success": false,
  "message": "Server error - please try again later",
  "error": "server_error"
}
```

---

## Implementation Examples

### **JavaScript/React Implementation**

#### **Basic Fetch Function**
```javascript
const getCategories = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 0,
    limit: params.limit || 10,
    search: params.search || '',
    sortBy: params.sortBy || 'name',
    sortOrder: params.sortOrder || 'asc',
  });

  try {
    const response = await fetch(`/api/customers/categories/paginated?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch categories');
    }

    return data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};
```

#### **React Hook Implementation**
```javascript
import { useState, useEffect, useCallback } from 'react';

const useCategories = (initialParams = {}) => {
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 0,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [search, setSearch] = useState({ term: '', results: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCategories = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getCategories(params);
      setCategories(result.data);
      setPagination(result.pagination);
      setSearch(result.search);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories(initialParams);
  }, [fetchCategories]);

  return {
    categories,
    pagination,
    search,
    loading,
    error,
    fetchCategories,
  };
};
```

#### **Advanced Search Component**
```javascript
const CategorySearch = ({ onSearch, onFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleSearch = () => {
    onSearch({
      search: searchTerm,
      sortBy,
      sortOrder,
      limit: itemsPerPage,
      page: 0, // Reset to first page
    });
  };

  const handleFilterChange = (filterType, value) => {
    const newFilters = { sortBy, sortOrder, limit: itemsPerPage };
    newFilters[filterType] = value;
    onFilter(newFilters);
  };

  return (
    <div className="search-controls">
      <input
        type="text"
        placeholder="Search categories..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
      />
      
      <select
        value={sortBy}
        onChange={(e) => handleFilterChange('sortBy', e.target.value)}
      >
        <option value="name">Name</option>
        <option value="createdAt">Created Date</option>
        <option value="updatedAt">Updated Date</option>
      </select>
      
      <select
        value={sortOrder}
        onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
      >
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
      
      <select
        value={itemsPerPage}
        onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
      >
        <option value={5}>5 per page</option>
        <option value={10}>10 per page</option>
        <option value={25}>25 per page</option>
        <option value={50}>50 per page</option>
      </select>
      
      <button onClick={handleSearch}>Search</button>
    </div>
  );
};
```

### **Python Implementation**

#### **Basic Python Client**
```python
import requests
from typing import Dict, List, Optional

class CategoryAPI:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_categories(self, 
                      page: int = 0, 
                      limit: int = 10, 
                      search: str = '', 
                      sort_by: str = 'name', 
                      sort_order: str = 'asc') -> Dict:
        """
        Fetch categories with pagination and filtering
        
        Args:
            page: Page number (0-based)
            limit: Items per page (1-100)
            search: Search term for category name
            sort_by: Sort field (name, createdAt, updatedAt)
            sort_order: Sort direction (asc, desc)
        
        Returns:
            Dict with categories, pagination, and search info
        """
        params = {
            'page': page,
            'limit': limit,
            'search': search,
            'sortBy': sort_by,
            'sortOrder': sort_order
        }
        
        try:
            response = requests.get(
                f'{self.base_url}/api/customers/categories/paginated',
                headers=self.headers,
                params=params
            )
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'message': str(e),
                'data': [],
                'pagination': {},
                'search': {}
            }

# Usage example
api = CategoryAPI('http://localhost:5550', 'your_jwt_token')
result = api.get_categories(search='VIP', page=0, limit=5)

if result['success']:
    print(f"Found {result['pagination']['totalItems']} categories")
    for category in result['data']:
        print(f"- {category['name']} (ID: {category['id']})")
else:
    print(f"Error: {result['message']}")
```

### **PHP Implementation**

#### **PHP Client Class**
```php
<?php
class CategoryAPI {
    private $baseUrl;
    private $token;
    
    public function __construct($baseUrl, $token) {
        $this->baseUrl = $baseUrl;
        $this->token = $token;
    }
    
    public function getCategories($params = []) {
        $defaultParams = [
            'page' => 0,
            'limit' => 10,
            'search' => '',
            'sortBy' => 'name',
            'sortOrder' => 'asc'
        ];
        
        $params = array_merge($defaultParams, $params);
        $queryString = http_build_query($params);
        
        $url = $this->baseUrl . '/api/customers/categories/paginated?' . $queryString;
        
        $headers = [
            'Authorization: Bearer ' . $this->token,
            'Content-Type: application/json',
            'Accept: application/json'
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPGET, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            return [
                'success' => false,
                'message' => 'HTTP Error: ' . $httpCode,
                'data' => [],
                'pagination' => [],
                'search' => []
            ];
        }
        
        return json_decode($response, true);
    }
}

// Usage example
$api = new CategoryAPI('http://localhost:5550', 'your_jwt_token');
$result = $api->getCategories([
    'search' => 'VIP',
    'page' => 0,
    'limit' => 5
]);

if ($result['success']) {
    echo "Found " . $result['pagination']['totalItems'] . " categories\n";
    foreach ($result['data'] as $category) {
        echo "- " . $category['name'] . " (ID: " . $category['id'] . ")\n";
    }
} else {
    echo "Error: " . $result['message'] . "\n";
}
?>
```

---

## Performance Considerations

### **Database Optimization**
- **Indexes**: Ensure database indexes on `user_id`, `name`, `createdAt`, `updatedAt`
- **Query Optimization**: Use LIMIT and OFFSET for pagination
- **Search Optimization**: Use SQL LIKE with proper indexing for search

### **Caching Strategy**
- **Response Caching**: Cache frequently accessed category lists
- **Search Caching**: Cache search results for common terms
- **Pagination Caching**: Cache pagination metadata

### **Rate Limiting**
- **Request Limits**: 100 requests per minute per user
- **Search Limits**: 10 search requests per minute per user
- **Pagination Limits**: Maximum 100 items per page

---

## Security Considerations

### **Authentication**
- JWT token required for all requests
- Token validation on every request
- Token expiration handling

### **Authorization**
- User can only access their own categories
- Permission `categories.read` required
- Role-based access control

### **Input Validation**
- Parameter sanitization
- SQL injection prevention
- XSS protection in search terms

---

## Testing Examples

### **Unit Tests**
```javascript
describe('Category API', () => {
  test('should fetch categories with pagination', async () => {
    const result = await getCategories({ page: 0, limit: 10 });
    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Array);
    expect(result.pagination).toBeDefined();
  });
  
  test('should search categories', async () => {
    const result = await getCategories({ search: 'VIP' });
    expect(result.success).toBe(true);
    expect(result.search.term).toBe('VIP');
  });
  
  test('should handle invalid parameters', async () => {
    const result = await getCategories({ page: -1, limit: 1000 });
    expect(result.success).toBe(false);
  });
});
```

### **Integration Tests**
```bash
# Test basic pagination
curl -X GET "http://localhost:5550/api/customers/categories/paginated?page=0&limit=10" \
  -H "Authorization: Bearer test_token"

# Test search functionality
curl -X GET "http://localhost:5550/api/customers/categories/paginated?search=VIP" \
  -H "Authorization: Bearer test_token"

# Test sorting
curl -X GET "http://localhost:5550/api/customers/categories/paginated?sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer test_token"
```

---

## Related Endpoints

- `POST /api/customers/categories` - Create new category
- `GET /api/customers/categories/{id}` - Get category by ID
- `PUT /api/customers/categories/{id}` - Update category
- `DELETE /api/customers/categories/{id}` - Delete category
- `GET /api/customers/categories` - Get all categories (simple list)

---

## Changelog

### **Version 1.0.0** (2025-01-01)
- Initial release
- Basic pagination support
- Search functionality
- Sorting capabilities
- Comprehensive error handling

### **Future Enhancements**
- Advanced filtering by date ranges
- Bulk operations support
- Export functionality
- Real-time updates via WebSocket