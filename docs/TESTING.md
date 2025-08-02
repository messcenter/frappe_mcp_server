# Testing Guide for Frappe MCP Server

This guide covers all testing approaches for the Frappe MCP server.

## Test Types

### 1. MCP Protocol Tests (`test-mcp-protocol.ts`)
Tests the complete MCP protocol implementation using the official MCP client.

```bash
npm run test-mcp
```

Features:
- Tests all 20 MCP tools
- Validates MCP protocol compliance
- Uses stdio transport
- Mock Frappe credentials

### 2. HTTP Server Tests (`test-http-server.js`)
Tests the HTTP transport implementation.

```bash
# Start HTTP server first
npm run start-http

# Run tests
npm run test-http
```

Tests:
- Health check endpoint
- Server info endpoint
- Tool listing
- Tool execution via HTTP
- Error handling

### 3. Real Frappe Integration Tests (`test-with-real-frappe.js`)
Tests against a real Frappe instance with actual credentials.

```bash
# Using environment variables
FRAPPE_URL=https://epinomy.com \
FRAPPE_API_KEY=ff09790d111aeab \
FRAPPE_API_SECRET=d3bc10957fd898f \
npm run test-real
```

Features:
- Real API calls to Frappe
- Validates actual data
- Tests all tool categories
- Performance benchmarks

### 4. Quick Tests (`quick-test.js`, `simple-test.js`)
Simple verification scripts for quick testing.

```bash
node quick-test.js
node simple-test.js
```

## Test Configuration

### Environment Variables
Create a `test-config.env` file (gitignored) with:

```env
FRAPPE_URL=https://your-frappe-instance.com
FRAPPE_API_KEY=your-api-key
FRAPPE_API_SECRET=your-api-secret
```

### Port Configuration
HTTP server runs on port 51966 (0xCAFE) by default. Override with:

```bash
PORT=8080 npm run start-http
```

## Running All Tests

```bash
# Build first
npm run build

# Run all test suites
npm run test-mcp && npm run test-http && npm run test-real
```

## Debugging Tests

### Enable Debug Output
```bash
DEBUG=* npm run test-real
```

### Test Specific Tools
Modify test files to focus on specific tools:

```javascript
// In test file
const tests = [
  () => this.testPing(),  // Only test ping
];
```

## Writing New Tests

### Adding to Protocol Tests
Add new test methods in `test-mcp-protocol.ts`:

```typescript
async testNewFeature() {
  const response = await this.client.callTool('new_tool', {
    param: 'value'
  });
  // Validate response
}
```

### Adding HTTP Tests
Add to `test-http-server.js`:

```javascript
async testNewEndpoint() {
  const response = await axios.get(`${this.baseUrl}/new-endpoint`);
  // Validate response
}
```

## Common Issues

### Server Not Responding
- Ensure server is built: `npm run build`
- Check correct port is used
- Verify credentials are set

### Authentication Failures
- Verify API key/secret are correct
- Check Frappe instance is accessible
- Ensure user has required permissions

### Timeout Errors
- Increase timeout values in test files
- Check network connectivity
- Verify Frappe server performance