#!/usr/bin/env node

/**
 * HTTP-based Frappe MCP Server
 * Simple HTTP wrapper around the MCP tools
 */

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { initializeStaticHints } from './static-hints.js';
import { initializeAppIntrospection } from './app-introspection.js';
import { validateApiCredentials } from './auth.js';
import { zodToJsonSchema } from './schema-generator.js';

// Import all tool functions directly
import { findDocTypes, getModuleList, getDocTypesInModule, doesDocTypeExist, doesDocumentExist, getDocumentCount, getNamingSeriesInfo, getRequiredFields } from './frappe-helpers.js';
import { getInstructions } from './frappe-instructions.js';
import { createDocument, getDocument, updateDocument, deleteDocument, listDocuments, callMethod } from './frappe-api.js';
import { getDocTypeSchema, getFieldOptions } from './frappe-api.js';
import { getDocTypeHints, getWorkflowHints, findWorkflowsForDocType } from './static-hints.js';
import { getDocTypeUsageInstructions, getAppForDocType, getAppUsageInstructions } from './app-introspection.js';

const app = express();
const port = process.env.PORT || 0xCAFE; // Port 51966 = 0xCAFE in hex. Perfect for a coffee framework!

app.use(cors());
app.use(express.json());

// Tool definitions with schemas
const tools = {
  ping: {
    description: "A simple tool to check if the server is responding.",
    schema: z.object({}),
    handler: async () => ({ content: [{ type: "text", text: "pong" }] })
  },

  find_doctypes: {
    description: "Find DocTypes in the system matching a search term",
    schema: z.object({
      search_term: z.string().optional(),
      module: z.string().optional(),
      is_table: z.boolean().optional(),
      is_single: z.boolean().optional(),
      is_custom: z.boolean().optional(),
      limit: z.number().optional()
    }),
    handler: async (params: any) => {
      const result = await findDocTypes(params.search_term, {
        module: params.module,
        isTable: params.is_table,
        isSingle: params.is_single,
        isCustom: params.is_custom,
        limit: params.limit
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  get_module_list: {
    description: "Get a list of all modules in the system",
    schema: z.object({}),
    handler: async () => {
      const result = await getModuleList();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  check_doctype_exists: {
    description: "Check if a DocType exists in the system",
    schema: z.object({
      doctype: z.string()
    }),
    handler: async (params: any) => {
      const exists = await doesDocTypeExist(params.doctype);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ doctype: params.doctype, exists }, null, 2)
        }]
      };
    }
  },

  get_doctype_schema: {
    description: "Get the complete schema for a DocType",
    schema: z.object({
      doctype: z.string()
    }),
    handler: async (params: any) => {
      const result = await getDocTypeSchema(params.doctype);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  list_documents: {
    description: "List documents from Frappe with filters",
    schema: z.object({
      doctype: z.string(),
      filters: z.record(z.any()).optional(),
      fields: z.array(z.string()).optional(),
      limit: z.number().optional(),
      order_by: z.string().optional(),
      limit_start: z.number().optional()
    }),
    handler: async (params: any) => {
      const result = await listDocuments(
        params.doctype,
        params.filters,
        params.fields,
        params.limit,
        params.order_by,
        params.limit_start
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    server: 'frappe-mcp-server',
    version: '0.2.16',
    transport: 'http'
  });
});

// Server info endpoint
app.get('/info', (req, res) => {
  const toolNames = Object.keys(tools);
  res.json({
    name: "frappe-mcp-server",
    version: "0.2.16",
    transport: "http",
    tools: toolNames.length,
    availableTools: toolNames,
    endpoints: {
      health: '/health',
      info: '/info',
      tools: '/tools',
      call: '/call/:toolName'
    }
  });
});

// List available tools
app.get('/tools', (req, res) => {
  const toolList = Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    schema: tool.schema.shape ? Object.keys(tool.schema.shape) : []
  }));
  
  res.json({ tools: toolList });
});

// Call a specific tool
app.post('/call/:toolName', async (req, res) => {
  try {
    const toolName = req.params.toolName;
    const tool = tools[toolName as keyof typeof tools];
    
    if (!tool) {
      return res.status(404).json({
        error: `Tool '${toolName}' not found`,
        availableTools: Object.keys(tools)
      });
    }

    // Validate parameters
    const params = tool.schema.parse(req.body);
    
    // Call the tool
    const result = await tool.handler(params);
    
    res.json({
      tool: toolName,
      success: true,
      result
    });

  } catch (error) {
    console.error(`Error calling tool ${req.params.toolName}:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      tool: req.params.toolName,
      success: false
    });
  }
});

// Generic tool call endpoint (MCP-style)
app.post('/mcp/call', async (req, res) => {
  try {
    const { tool, parameters = {} } = req.body;
    
    if (!tool || !tools[tool as keyof typeof tools]) {
      return res.status(404).json({
        error: `Tool '${tool}' not found`,
        availableTools: Object.keys(tools)
      });
    }

    const toolDef = tools[tool as keyof typeof tools];
    const params = toolDef.schema.parse(parameters);
    const result = await toolDef.handler(params);
    
    res.json({
      jsonrpc: "2.0",
      id: req.body.id || 1,
      result
    });

  } catch (error) {
    console.error(`Error in MCP call:`, error);
    
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body.id || 1,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    });
  }
});

// Root endpoint for MCP JSON-RPC requests (Claude's expected endpoint)
app.post('/', async (req, res) => {
  try {
    const { method, params = {}, id = 1 } = req.body;
    
    // Handle MCP protocol methods
    if (method === 'tools/list') {
      const toolList = Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.schema)
      }));
      
      return res.json({
        jsonrpc: "2.0",
        id,
        result: { tools: toolList }
      });
    }
    
    if (method === 'tools/call') {
      const { name: toolName, arguments: toolArgs = {} } = params;
      
      if (!toolName || !tools[toolName as keyof typeof tools]) {
        return res.status(404).json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Tool '${toolName}' not found`,
            data: { availableTools: Object.keys(tools) }
          }
        });
      }

      const toolDef = tools[toolName as keyof typeof tools];
      const validatedArgs = toolDef.schema.parse(toolArgs);
      const result = await toolDef.handler(validatedArgs);
      
      return res.json({
        jsonrpc: "2.0",
        id,
        result
      });
    }
    
    if (method === 'initialize') {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "frappe-mcp-server",
            version: "0.2.16"
          }
        }
      });
    }
    
    // Method not found
    return res.status(404).json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method '${method}' not found`
      }
    });

  } catch (error) {
    console.error(`Error in MCP JSON-RPC call:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: req.body.id || 1,
        error: {
          code: -32602,
          message: 'Invalid parameters',
          data: error.errors
        }
      });
    }
    
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body.id || 1,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    });
  }
});

async function startServer() {
  try {
    console.log("Starting Frappe MCP HTTP server...");
    
    // Validate credentials
    await validateApiCredentials();
    console.log("API credentials validation successful.");

    // Initialize components
    console.log("Initializing static hints...");
    await initializeStaticHints();
    console.log("Static hints initialized successfully");

    console.log("Initializing app introspection...");
    await initializeAppIntrospection();
    console.log("App introspection initialized successfully");

    // Start HTTP server
    app.listen(port, () => {
      console.log(`☕ Frappe MCP server running on HTTP at http://localhost:${port}`);
      console.log(`☕ Port ${port} = 0xCAFE in hexadecimal. Welcome to the Frappe Café!`);
      console.log(`📋 Available endpoints:`);
      console.log(`   GET  /health     - Health check`);
      console.log(`   GET  /info       - Server information`);
      console.log(`   GET  /tools      - List available tools`);
      console.log(`   POST /call/:tool - Call a specific tool`);
      console.log(`   POST /mcp/call   - MCP-style tool calls`);
      console.log(`\n🧪 Test with: npm run test-http`);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Frappe MCP HTTP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Frappe MCP HTTP server...');
  process.exit(0);
});

startServer();