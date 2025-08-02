#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return '0.6.0'; // fallback version
  }
}

function checkVersionFlag(): boolean {
  const args = process.argv.slice(2);
  return args.includes('--version') || args.includes('-v');
}

// Handle version flag before any other imports
if (checkVersionFlag()) {
  console.log(getVersion());
  process.exit(0);
}

// Now import everything else
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleCallMethodToolCall } from "./document-operations.js";
import { setupDocumentTools } from "./document-operations.js";
import { setupSchemaTools } from "./schema-operations.js";
import { setupHelperTools } from "./helper-tools.js";
import { setupReportTools } from "./report-operations.js";
import { validateApiCredentials } from './auth.js';

async function main() {
  console.error("Starting Frappe MCP server...");
  console.error("Current working directory:", process.cwd());

  // Validate API credentials at startup
  const credentialsCheck = validateApiCredentials();
  if (!credentialsCheck.valid) {
    console.error(`ERROR: ${credentialsCheck.message}`);
    console.error("The server will start, but most operations will fail without valid API credentials.");
    console.error("Please set FRAPPE_API_KEY and FRAPPE_API_SECRET environment variables.");
  } else {
    console.error("API credentials validation successful.");
  }

  const server = new McpServer({
    name: "frappe-mcp-server",
    version: getVersion(),
  });

  setupSchemaTools(server);
  setupDocumentTools(server);
  setupHelperTools(server);
  setupReportTools(server);

  // Register version tool
  server.tool(
    "version",
    "Get version information for the Frappe MCP server",
    {},
    async () => ({
      content: [{ type: "text", text: `Frappe MCP Server version ${getVersion()}` }]
    })
  );

  // Register ping tool using modern API
  server.tool(
    "ping",
    "A simple tool to check if the server is responding.",
    {},
    async () => ({
      content: [{ type: "text", text: "pong" }]
    })
  );

  // Register call_method tool using modern API
  server.tool(
    "call_method",
    "Execute a whitelisted Frappe method",
    {
      method: z.string().describe("Method name to call (whitelisted)"),
      params: z.object({}).optional().describe("Parameters to pass to the method (optional)")
    },
    async (args) => {
      console.error(`Received call_method tool call`);
      // Create a mock request object for backward compatibility
      const mockRequest = {
        params: {
          name: "call_method",
          arguments: args
        }
      };
      return await handleCallMethodToolCall(mockRequest);
    }
  );

  // Modern McpServer handles errors automatically

  process.on("SIGINT", async () => {
    console.error("Shutting down Frappe MCP server...");
    await server.close();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Frappe MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});