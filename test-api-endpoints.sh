#!/bin/bash

# Test Script for New API Endpoints
# Usage: ./test-api-endpoints.sh YOUR_API_KEY

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_KEY="${1:-YOUR_API_KEY_HERE}"
BASE_URL="${2:-http://localhost:3880}"

echo "=========================================="
echo "Testing WhatsApp API Endpoints"
echo "=========================================="
echo "API Key: ${API_KEY}"
echo "Base URL: ${BASE_URL}"
echo ""

# Function to test an endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo "----------------------------------------"
    echo -e "${YELLOW}Testing: ${name}${NC}"
    echo "Endpoint: ${method} ${endpoint}"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X ${method} \
            -H "x-api-key: ${API_KEY}" \
            "${BASE_URL}${endpoint}")
    else
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X ${method} \
            -H "x-api-key: ${API_KEY}" \
            -H "Content-Type: application/json" \
            -d "${data}" \
            "${BASE_URL}${endpoint}")
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "${GREEN}✓ Success (HTTP ${http_code})${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP ${http_code})${NC}"
    fi
    
    echo "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    echo ""
}

# Check if API key is provided
if [ "$API_KEY" = "YOUR_API_KEY_HERE" ]; then
    echo -e "${RED}Error: Please provide your API key${NC}"
    echo "Usage: $0 YOUR_API_KEY [BASE_URL]"
    echo "Example: $0 wa_1234567890abcdef http://localhost:3880"
    exit 1
fi

# Test 1: Get Usage Statistics
test_endpoint \
    "Get Usage Statistics" \
    "GET" \
    "/api/usage"

# Test 2: Get Usage with Period Filter
test_endpoint \
    "Get Usage (Today)" \
    "GET" \
    "/api/usage?period=today"

# Test 3: Send Single Message (will fail if phone is invalid)
test_endpoint \
    "Send Single Message" \
    "POST" \
    "/api/messages/send" \
    '{"phone": "1234567890", "message": "Test message from API"}'

# Test 4: Get Message History
test_endpoint \
    "Get Message History" \
    "GET" \
    "/api/messages?page=1&limit=10"

# Test 5: Get Messages by Status
test_endpoint \
    "Get Sent Messages" \
    "GET" \
    "/api/messages/status/sent"

# Test 6: Get Failed Messages
test_endpoint \
    "Get Failed Messages" \
    "GET" \
    "/api/messages/failed"

# Test 7: Test invalid API key
echo "----------------------------------------"
echo -e "${YELLOW}Testing: Invalid API Key${NC}"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET \
    -H "x-api-key: invalid_key_12345" \
    "${BASE_URL}/api/usage")

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

if [ "$http_code" -eq 401 ]; then
    echo -e "${GREEN}✓ Correctly rejected invalid API key (HTTP ${http_code})${NC}"
else
    echo -e "${RED}✗ Unexpected response (HTTP ${http_code})${NC}"
fi
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

# Test 8: Test missing API key
echo "----------------------------------------"
echo -e "${YELLOW}Testing: Missing API Key${NC}"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET \
    "${BASE_URL}/api/usage")

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

if [ "$http_code" -eq 401 ]; then
    echo -e "${GREEN}✓ Correctly rejected missing API key (HTTP ${http_code})${NC}"
else
    echo -e "${RED}✗ Unexpected response (HTTP ${http_code})${NC}"
fi
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

echo "=========================================="
echo "Testing Complete"
echo "=========================================="
echo ""
echo "Notes:"
echo "- Message sending tests may fail if WhatsApp is not connected"
echo "- Some endpoints return empty data (TODO: database implementation)"
echo "- Usage limits management requires admin privileges"


