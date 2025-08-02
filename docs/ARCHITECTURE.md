# Frappe MCP Server Architecture

## Overview

The Frappe MCP server provides a bridge between AI assistants (like Claude) and Frappe/ERPNext systems using the Model Context Protocol (MCP).

## Architecture Components

### 1. Transport Layer
Supports two transport mechanisms:

#### stdio Transport (Default)
- Used by Claude Desktop
- Communication via stdin/stdout
- Single instance per process
- Most secure (local only)

#### HTTP Transport (Port 51966/0xCAFE)
- RESTful API endpoints
- Multiple concurrent clients
- Remote access capability
- CORS enabled

### 2. Core Components

#### Authentication (`auth.ts`)
- Validates Frappe API credentials
- Supports API key/secret authentication
- Token-based authentication
- Environment variable configuration

#### Tool Registry
Tools are organized into three categories:

1. **Document Operations** (`document-operations.ts`)
   - create_document
   - get_document
   - update_document
   - delete_document
   - list_documents
   - reconcile_bank_transaction_with_vouchers

2. **Schema Operations** (`schema-operations.ts`)
   - get_doctype_schema
   - get_field_options
   - get_frappe_usage_info

3. **Helper Tools** (`helper-tools.ts`)
   - find_doctypes
   - get_module_list
   - get_doctypes_in_module
   - check_doctype_exists
   - check_document_exists
   - get_document_count
   - get_naming_info
   - get_required_fields
   - get_api_instructions
   - ping

### 3. API Layer

#### Frappe API Client (`frappe-api.ts`)
- HTTP client for Frappe REST API
- Automatic token refresh
- Error handling and retries
- Request/response logging

#### Document API (`document-api.ts`)
- High-level document operations
- Validation and error handling
- Retry logic for failed operations

#### Schema API (`schema-api.ts`)
- DocType schema retrieval
- Field metadata operations
- Validation rules

### 4. Enhancement Features

#### Static Hints (`static-hints.ts`)
- Pre-loaded DocType hints
- Workflow information
- Best practices and tips

#### App Introspection (`app-introspection.ts`)
- Dynamic app discovery
- Module analysis
- Usage instructions

#### Frappe Instructions (`frappe-instructions.ts`)
- Categorized API documentation
- Operation guides
- Best practices

## Data Flow

### stdio Transport Flow
```
Claude Desktop → stdin → MCP Server → Frappe API → Response → stdout → Claude Desktop
```

### HTTP Transport Flow
```
HTTP Client → Express Router → Tool Handler → Frappe API → JSON Response → HTTP Client
```

## Directory Structure

```
frappe_mcp_server/
├── src/                    # Source code
│   ├── index.ts           # stdio server entry
│   ├── http-server.ts     # HTTP server entry
│   ├── auth.ts            # Authentication
│   ├── frappe-api.ts      # API client
│   ├── document-*.ts      # Document operations
│   ├── schema-*.ts        # Schema operations
│   ├── helper-tools.ts    # Helper utilities
│   └── static-hints.ts    # Static data
├── build/                 # Compiled JavaScript
├── docs/                  # Documentation
├── server_hints/          # Static hint files
└── tests/                 # Test files
```

## Security Considerations

1. **Credentials**: Never hardcode credentials
2. **Transport**: stdio is more secure than HTTP
3. **Validation**: All inputs are validated with Zod
4. **Error Handling**: Sensitive data is not exposed in errors

## Performance Optimizations

1. **Static Hints**: Pre-loaded at startup
2. **Connection Pooling**: Reused HTTP connections
3. **Caching**: Schema and metadata caching
4. **Batch Operations**: Where supported by Frappe

## Extension Points

### Adding New Tools
1. Create tool function in appropriate file
2. Register with McpServer using `server.tool()`
3. Add Zod schema for validation
4. Update documentation

### Adding New Transports
1. Implement transport handler
2. Add to server initialization
3. Update configuration options
4. Add tests

## Configuration

### Environment Variables
- `FRAPPE_URL`: Frappe instance URL
- `FRAPPE_API_KEY`: API key for authentication
- `FRAPPE_API_SECRET`: API secret
- `PORT`: HTTP server port (default: 51966)

### MCP Configuration
- `.mcp.json`: Project-level config
- Command-line arguments
- Environment variables

## Error Handling

### Error Categories
1. **Authentication Errors**: Invalid credentials
2. **Network Errors**: Connection failures
3. **Validation Errors**: Invalid parameters
4. **Frappe Errors**: API-level errors

### Error Response Format
```json
{
  "error": {
    "code": -32603,
    "message": "Error description",
    "data": "Additional context"
  }
}
```

## Monitoring and Debugging

### Logging
- Console output for all operations
- Structured error messages
- Debug mode available

### Health Checks
- `/health` endpoint for HTTP
- `ping` tool for connectivity

### Testing
- Protocol-level tests
- Integration tests
- Real Frappe tests