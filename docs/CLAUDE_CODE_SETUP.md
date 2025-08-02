# Setting Up Frappe MCP Server for Claude Code

This guide explains how to configure the Frappe MCP server so Claude Code can use it.

## Prerequisites

1. Build the server:
   ```bash
   npm run build
   ```

2. For HTTP transport, start the server:
   ```bash
   FRAPPE_URL=https://epinomy.com \
   FRAPPE_API_KEY=ff09790d111aeab \
   FRAPPE_API_SECRET=d3bc10957fd898f \
   npm run start-http
   ```

## Method 1: Add as HTTP Server (Recommended for Development)

Since our server runs on port 51966 (0xCAFE), you can add it as an HTTP server:

```bash
# Add the HTTP server to Claude Code
claude mcp add --transport http frappe-epinomy http://localhost:51966

# Or with environment variables
claude mcp add --transport http frappe-epinomy http://localhost:51966 \
  --env FRAPPE_URL=https://epinomy.com \
  --env FRAPPE_API_KEY=ff09790d111aeab \
  --env FRAPPE_API_SECRET=d3bc10957fd898f
```

## Method 2: Add as stdio Server (Like Claude Desktop)

For stdio transport (similar to Claude Desktop):

```bash
# From the project directory
claude mcp add frappe-epinomy "$(pwd)/build/index.js" \
  --env FRAPPE_URL=https://epinomy.com \
  --env FRAPPE_API_KEY=ff09790d111aeab \
  --env FRAPPE_API_SECRET=d3bc10957fd898f
```

## Method 3: Use Project Configuration

The `.mcp.json` file in this directory already contains both configurations. To use it:

```bash
# From the project directory, Claude Code will automatically detect .mcp.json
claude

# Or explicitly load the config
claude --mcp-config .mcp.json
```

## Method 4: Add via JSON

You can also add the server configuration directly:

```bash
# For HTTP server
claude mcp add-json frappe-http '{
  "type": "http",
  "url": "http://localhost:51966",
  "env": {
    "FRAPPE_URL": "https://epinomy.com",
    "FRAPPE_API_KEY": "ff09790d111aeab",
    "FRAPPE_API_SECRET": "d3bc10957fd898f"
  }
}'

# For stdio server
claude mcp add-json frappe-stdio '{
  "command": "node",
  "args": ["'$(pwd)'/build/index.js"],
  "env": {
    "FRAPPE_URL": "https://epinomy.com",
    "FRAPPE_API_KEY": "ff09790d111aeab",
    "FRAPPE_API_SECRET": "d3bc10957fd898f"
  }
}'
```

## Verifying the Setup

Once added, you can verify the MCP server is working:

1. Start Claude Code
2. The server should appear in available MCP servers
3. You can use `@frappe-epinomy` to reference the server
4. Tools like `find_doctypes`, `get_doctype_schema`, etc. will be available

## Available Tools

Once configured, Claude Code can use these Frappe tools:

- `ping` - Check server connectivity
- `find_doctypes` - Search for DocTypes
- `get_module_list` - List all modules
- `check_doctype_exists` - Verify DocType existence
- `get_doctype_schema` - Get DocType structure
- `list_documents` - Query documents
- `create_document` - Create new documents
- `update_document` - Update existing documents
- `delete_document` - Delete documents
- And 11 more tools...

## Troubleshooting

- **HTTP Server**: Make sure the server is running on port 51966
- **stdio Server**: Ensure the build directory exists and has executable permissions
- **Debug Mode**: Run Claude Code with `claude --mcp-debug` for detailed error info
- **Port Conflicts**: If 51966 is taken, set `PORT` environment variable

## Notes

- The HTTP transport allows multiple Claude Code instances to connect
- The stdio transport is more secure but single-instance only
- Port 51966 (0xCAFE) was chosen for the coffee/frappe theme ☕