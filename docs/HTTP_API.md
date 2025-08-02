# HTTP API Reference

The Frappe MCP server provides an HTTP transport option running on port 51966 (0xCAFE).

## Base URL
```
http://localhost:51966
```

## Endpoints

### Health Check
Check if the server is running and healthy.

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "server": "frappe-mcp-server",
  "version": "0.2.16",
  "transport": "http"
}
```

### Server Information
Get server capabilities and available tools.

```http
GET /info
```

Response:
```json
{
  "name": "frappe-mcp-server",
  "version": "0.2.16",
  "transport": "http",
  "tools": 20,
  "availableTools": ["ping", "find_doctypes", ...],
  "endpoints": {
    "health": "/health",
    "info": "/info",
    "tools": "/tools",
    "call": "/call/:toolName"
  }
}
```

### List Tools
Get detailed information about all available tools.

```http
GET /tools
```

Response:
```json
{
  "tools": [
    {
      "name": "ping",
      "description": "A simple tool to check if the server is responding.",
      "schema": []
    },
    {
      "name": "find_doctypes",
      "description": "Find DocTypes in the system matching a search term",
      "schema": ["search_term", "module", "is_table", "is_single", "is_custom", "limit"]
    }
  ]
}
```

### Call Tool
Execute a specific tool with parameters.

```http
POST /call/:toolName
Content-Type: application/json

{
  "parameter1": "value1",
  "parameter2": "value2"
}
```

Response:
```json
{
  "tool": "toolName",
  "success": true,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool output"
      }
    ]
  }
}
```

### MCP-Style Call
Execute tools using MCP protocol format.

```http
POST /mcp/call
Content-Type: application/json

{
  "tool": "toolName",
  "parameters": {
    "param1": "value1"
  },
  "id": 1
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool output"
      }
    ]
  }
}
```

## Tool Examples

### Ping
```bash
curl -X POST http://localhost:51966/call/ping \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Find DocTypes
```bash
curl -X POST http://localhost:51966/call/find_doctypes \
  -H "Content-Type: application/json" \
  -d '{
    "search_term": "User",
    "limit": 5
  }'
```

### Get Module List
```bash
curl -X POST http://localhost:51966/call/get_module_list \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Check DocType Exists
```bash
curl -X POST http://localhost:51966/call/check_doctype_exists \
  -H "Content-Type: application/json" \
  -d '{
    "doctype": "Customer"
  }'
```

### Get DocType Schema
```bash
curl -X POST http://localhost:51966/call/get_doctype_schema \
  -H "Content-Type: application/json" \
  -d '{
    "doctype": "User"
  }'
```

### List Documents
```bash
curl -X POST http://localhost:51966/call/list_documents \
  -H "Content-Type: application/json" \
  -d '{
    "doctype": "User",
    "filters": {"enabled": 1},
    "fields": ["name", "email"],
    "limit": 10
  }'
```

## Error Responses

### 400 Bad Request
Invalid parameters provided.

```json
{
  "error": "Invalid parameters",
  "details": [
    {
      "path": ["doctype"],
      "message": "Required"
    }
  ]
}
```

### 404 Not Found
Tool not found.

```json
{
  "error": "Tool 'invalid_tool' not found",
  "availableTools": ["ping", "find_doctypes", ...]
}
```

### 500 Internal Server Error
Server or Frappe API error.

```json
{
  "error": "Error message",
  "tool": "toolName",
  "success": false
}
```

## Authentication

The HTTP server uses the same authentication as configured:
- Set via environment variables when starting the server
- Passed through to Frappe API calls
- No additional HTTP authentication required

## CORS

CORS is enabled for all origins to facilitate browser-based usage.

## Rate Limiting

Currently no rate limiting is implemented. For production use, consider adding rate limiting middleware.