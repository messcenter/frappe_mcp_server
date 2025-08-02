#!/usr/bin/env node

/**
 * Streamable HTTP-based Frappe MCP Server
 * Implements the modern MCP Streamable HTTP transport with optional SSE streaming
 */

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeStaticHints } from './static-hints.js';
import { initializeAppIntrospection } from './app-introspection.js';
import { validateApiCredentials } from './auth.js';
import { logger } from './logger.js';
import { zodToJsonSchema, getToolCategories, categorizeTools } from './schema-generator.js';
import { rateLimitMiddleware, metricsMiddleware, requestLoggingMiddleware, securityMiddleware, errorHandlingMiddleware, getMetrics, updateSessionMetrics } from './middleware.js';
import { listResources, getResource, getResourceCategories } from './resources.js';
import { listPrompts, getPrompt } from './prompts.js';

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

// Import all tool functions
import { findDocTypes, getModuleList, getDocTypesInModule, doesDocTypeExist, doesDocumentExist, getDocumentCount, getNamingSeriesInfo, getRequiredFields } from './frappe-helpers.js';
import { getInstructions } from './frappe-instructions.js';
import { createDocument, getDocument, updateDocument, deleteDocument, listDocuments, callMethod } from './frappe-api.js';
import { getDocTypeSchema, getFieldOptions } from './frappe-api.js';
import { getDocTypeHints, getWorkflowHints, findWorkflowsForDocType } from './static-hints.js';
import { getDocTypeUsageInstructions, getAppForDocType, getAppUsageInstructions } from './app-introspection.js';

const app = express();
const port = process.env.PORT || 0xCAF1; // Port 51953 = 0xCAF1 (CAFE+1) in hex

// Session management
interface Session {
  id: string;
  clientId?: string;
  createdAt: Date;
  lastActivity: Date;
  messageQueue: any[];
}

const sessions = new Map<string, Session>();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Enhanced middleware stack
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://claude.ai', 'https://cursor.sh'] : '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-api-key']
}));

app.use(express.json({ limit: '4mb' }));
app.use(requestLoggingMiddleware);
app.use(securityMiddleware);
app.use(rateLimitMiddleware);
app.use(metricsMiddleware);

// Session middleware
app.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      req.session = session;
    }
  }
  
  next();
});

// Clean up expired sessions
setInterval(() => {
  const now = Date.now();
  let removedCount = 0;
  for (const [id, session] of sessions) {
    if (now - session.lastActivity.getTime() > SESSION_TIMEOUT) {
      sessions.delete(id);
      removedCount++;
      logger.debug(`Session ${id} expired and removed`);
    }
  }
  
  // Update session metrics
  updateSessionMetrics(sessions.size, sessions.size + removedCount);
  
  if (removedCount > 0) {
    logger.info(`Cleaned up ${removedCount} expired sessions. Active sessions: ${sessions.size}`);
  }
}, 60000); // Check every minute

// Tool definitions (same as http-server.ts)
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
      return { content: [{ type: "text", text: JSON.stringify({ exists }, null, 2) }] };
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
  },

  // Document Operations
  create_document: {
    description: "Create a new document in Frappe",
    schema: z.object({
      doctype: z.string(),
      values: z.record(z.any())
    }),
    handler: async (params: any) => {
      const result = await createDocument(params.doctype, params.values);
      return { content: [{ type: "text", text: `Document created successfully. Name: ${result.name}` }] };
    }
  },

  get_document: {
    description: "Retrieve a document from Frappe",
    schema: z.object({
      doctype: z.string(),
      name: z.string(),
      fields: z.array(z.string()).optional()
    }),
    handler: async (params: any) => {
      const result = await getDocument(params.doctype, params.name, params.fields);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  update_document: {
    description: "Update an existing document in Frappe",
    schema: z.object({
      doctype: z.string(),
      name: z.string(),
      values: z.record(z.any())
    }),
    handler: async (params: any) => {
      const result = await updateDocument(params.doctype, params.name, params.values);
      return { content: [{ type: "text", text: `Document updated successfully. Name: ${result.name}` }] };
    }
  },

  delete_document: {
    description: "Delete a document from Frappe",
    schema: z.object({
      doctype: z.string(),
      name: z.string()
    }),
    handler: async (params: any) => {
      await deleteDocument(params.doctype, params.name);
      return { content: [{ type: "text", text: `Document deleted successfully. DocType: ${params.doctype}, Name: ${params.name}` }] };
    }
  },

  // Schema Operations
  get_field_options: {
    description: "Get available options for a Link or Select field",
    schema: z.object({
      doctype: z.string(),
      fieldname: z.string(),
      filters: z.record(z.any()).optional()
    }),
    handler: async (params: any) => {
      const result = await getFieldOptions(params.doctype, params.fieldname, params.filters);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  get_frappe_usage_info: {
    description: "Get combined information about a DocType or workflow",
    schema: z.object({
      doctype: z.string().optional(),
      workflow: z.string().optional()
    }),
    handler: async (params: any) => {
      let result = {};
      
      if (params.doctype) {
        const schema = await getDocTypeSchema(params.doctype);
        const hints = getDocTypeHints(params.doctype);
        const app = await getAppForDocType(params.doctype);
        const appInstructions = app ? await getAppUsageInstructions(app) : null;
        const docTypeInstructions = await getDocTypeUsageInstructions(params.doctype);
        
        result = {
          doctype: params.doctype,
          schema,
          hints,
          app,
          appInstructions,
          docTypeInstructions
        };
      }
      
      if (params.workflow) {
        const workflowHints = getWorkflowHints(params.workflow);
        result = {
          workflow: params.workflow,
          hints: workflowHints
        };
      }
      
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  // Helper Tools
  get_doctypes_in_module: {
    description: "Get a list of DocTypes in a specific module",
    schema: z.object({
      module: z.string()
    }),
    handler: async (params: any) => {
      const result = await getDocTypesInModule(params.module);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  check_document_exists: {
    description: "Check if a document exists",
    schema: z.object({
      doctype: z.string(),
      name: z.string()
    }),
    handler: async (params: any) => {
      const exists = await doesDocumentExist(params.doctype, params.name);
      return { content: [{ type: "text", text: JSON.stringify({ exists }, null, 2) }] };
    }
  },

  get_document_count: {
    description: "Get a count of documents matching filters",
    schema: z.object({
      doctype: z.string(),
      filters: z.record(z.any()).optional()
    }),
    handler: async (params: any) => {
      const count = await getDocumentCount(params.doctype, params.filters);
      return { content: [{ type: "text", text: JSON.stringify({ count }, null, 2) }] };
    }
  },

  get_naming_info: {
    description: "Get the naming series information for a DocType",
    schema: z.object({
      doctype: z.string()
    }),
    handler: async (params: any) => {
      const namingInfo = await getNamingSeriesInfo(params.doctype);
      return { content: [{ type: "text", text: JSON.stringify(namingInfo, null, 2) }] };
    }
  },

  get_required_fields: {
    description: "Get a list of required fields for a DocType",
    schema: z.object({
      doctype: z.string()
    }),
    handler: async (params: any) => {
      const requiredFields = await getRequiredFields(params.doctype);
      return { content: [{ type: "text", text: JSON.stringify(requiredFields, null, 2) }] };
    }
  },

  get_api_instructions: {
    description: "Get detailed instructions for using the Frappe API",
    schema: z.object({
      category: z.string(),
      operation: z.string()
    }),
    handler: async (params: any) => {
      const instructions = getInstructions(params.category, params.operation);
      return { content: [{ type: "text", text: instructions }] };
    }
  },

  // System Tools
  version: {
    description: "Get version information for the Frappe MCP server",
    schema: z.object({}),
    handler: async () => {
      const packageVersion = getVersion();
      return { content: [{ type: "text", text: `Frappe MCP Server version ${packageVersion}` }] };
    }
  },

  call_method: {
    description: "Execute a whitelisted Frappe method",
    schema: z.object({
      method: z.string(),
      params: z.record(z.any()).optional()
    }),
    handler: async (params: any) => {
      const result = await callMethod(params.method, params.params || {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  // Document Operations - Special
  reconcile_bank_transaction_with_vouchers: {
    description: "Reconciles a Bank Transaction document with specified vouchers",
    schema: z.object({
      bank_transaction_name: z.string(),
      vouchers: z.array(z.object({
        payment_doctype: z.string(),
        payment_name: z.string(),
        amount: z.number()
      }))
    }),
    handler: async (params: any) => {
      const result = await callMethod(
        "erpnext.accounts.doctype.bank_transaction.bank_transaction.reconcile_bank_transaction_with_vouchers",
        {
          bank_transaction_name: params.bank_transaction_name,
          vouchers: params.vouchers
        }
      );
      return { content: [{ type: "text", text: `Bank transaction reconciled successfully: ${JSON.stringify(result, null, 2)}` }] };
    }
  },

  // Report Operations
  run_query_report: {
    description: "Execute a Frappe query report with filters",
    schema: z.object({
      report_name: z.string(),
      filters: z.record(z.any()).optional(),
      user: z.string().optional()
    }),
    handler: async (params: any) => {
      const result = await callMethod('frappe.desk.query_report.run', {
        report_name: params.report_name,
        filters: params.filters || {},
        user: params.user
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  get_report_meta: {
    description: "Get metadata for a specific report including columns and filters",
    schema: z.object({
      report_name: z.string()
    }),
    handler: async (params: any) => {
      const result = await callMethod('frappe.desk.query_report.get_report_meta', {
        report_name: params.report_name
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  list_reports: {
    description: "Get a list of all available reports in the system",
    schema: z.object({
      module: z.string().optional()
    }),
    handler: async (params: any) => {
      const filters = params.module ? { module: params.module } : {};
      const result = await listDocuments('Report', filters, ['name', 'report_name', 'report_type', 'module']);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  export_report: {
    description: "Export a report in PDF, Excel, or CSV format",
    schema: z.object({
      report_name: z.string(),
      file_format: z.enum(["PDF", "Excel", "CSV"]),
      filters: z.record(z.any()).optional(),
      visible_idx: z.array(z.number()).optional()
    }),
    handler: async (params: any) => {
      const result = await callMethod('frappe.desk.query_report.export_query', {
        report_name: params.report_name,
        file_format: params.file_format,
        filters: params.filters || {},
        visible_idx: params.visible_idx
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  get_financial_statements: {
    description: "Get standard financial reports (P&L, Balance Sheet, Cash Flow)",
    schema: z.object({
      report_type: z.enum(["Profit and Loss Statement", "Balance Sheet", "Cash Flow"]),
      company: z.string(),
      from_date: z.string(),
      to_date: z.string(),
      periodicity: z.enum(["Monthly", "Quarterly", "Half-Yearly", "Yearly"]).optional(),
      include_default_book_entries: z.boolean().optional()
    }),
    handler: async (params: any) => {
      const result = await callMethod('frappe.desk.query_report.run', {
        report_name: params.report_type,
        filters: {
          company: params.company,
          from_date: params.from_date,
          to_date: params.to_date,
          periodicity: params.periodicity || "Yearly",
          include_default_book_entries: params.include_default_book_entries || 0
        }
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  get_report_columns: {
    description: "Get the column structure for a specific report",
    schema: z.object({
      report_name: z.string(),
      filters: z.record(z.any()).optional()
    }),
    handler: async (params: any) => {
      const result = await callMethod('frappe.desk.query_report.get_columns', {
        report_name: params.report_name,
        filters: params.filters || {}
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  run_doctype_report: {
    description: "Run a standard doctype report with filters and sorting",
    schema: z.object({
      doctype: z.string(),
      fields: z.array(z.string()).optional(),
      filters: z.record(z.any()).optional(),
      order_by: z.string().optional(),
      limit: z.number().optional()
    }),
    handler: async (params: any) => {
      const result = await listDocuments(
        params.doctype,
        params.filters,
        params.fields,
        params.limit,
        params.order_by
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  }
};

// Helper to determine if a method should stream
function shouldStream(method: string, userAgent?: string): boolean {
  // Cursor doesn't handle SSE properly, disable streaming for it
  if (userAgent?.includes('Cursor')) {
    return false;
  }
  
  // Methods that might benefit from streaming
  const streamableMethods = [
    'resources/read', // Large resource reads
    'prompts/run', // Interactive prompts
  ];
  
  return streamableMethods.some(m => method?.startsWith(m));
}

// Helper to send SSE message
function sendSSE(res: express.Response, data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  res.write(message);
}

// GET endpoint for Streamable HTTP SSE connections
app.get('/', async (req, res) => {
  // This is for Streamable HTTP SSE connections from clients like Cursor
  const sessionId = crypto.randomUUID();
  const session: Session = {
    id: sessionId,
    createdAt: new Date(),
    lastActivity: new Date(),
    messageQueue: []
  };
  sessions.set(sessionId, session);
  updateSessionMetrics(sessions.size, sessions.size);

  logger.info(`Starting SSE connection for session ${sessionId}`);

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Accept, mcp-protocol-version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'x-session-id': sessionId
  });

  // Send welcome message
  sendSSE(res, {
    type: 'welcome',
    sessionId: sessionId,
    protocolVersion: '2025-06-18',
    serverInfo: {
      name: 'frappe-mcp-server',
      version: getVersion()
    }
  });

  // Keep connection alive
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sessions.delete(sessionId);
    updateSessionMetrics(sessions.size, sessions.size);
    logger.info(`SSE connection closed for session ${sessionId}`);
  });
});

// Main MCP endpoint - Streamable HTTP
app.post('/', async (req, res) => {
  try {
    const { jsonrpc, method, params = {}, id } = req.body;
    
    // Validate JSON-RPC format
    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id || null,
        error: {
          code: -32600,
          message: "Invalid Request - must use JSON-RPC 2.0"
        }
      });
    }

    // Session handling for stateful operations
    let session = req.session;
    if (!session && method === 'initialize') {
      // Create new session
      session = {
        id: randomUUID(),
        createdAt: new Date(),
        lastActivity: new Date(),
        messageQueue: []
      };
      sessions.set(session.id, session);
      res.setHeader('x-session-id', session.id);
    }

    // Determine if we should stream the response
    const streaming = shouldStream(method, req.headers['user-agent']) && req.headers.accept?.includes('text/event-stream');
    
    if (streaming) {
      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'x-session-id': session?.id || ''
      });

      // Send initial response
      sendSSE(res, {
        jsonrpc: "2.0",
        id,
        result: {
          streaming: true,
          sessionId: session?.id
        }
      });

      // Keep connection alive
      const heartbeat = setInterval(() => {
        res.write(':heartbeat\n\n');
      }, 30000);

      // Clean up on disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        logger.debug(`SSE connection closed for session ${session?.id}`);
      });
    }

    // Handle MCP protocol methods
    switch (method) {
      case 'initialize': {
        const result = {
          protocolVersion: "2025-06-18",
          capabilities: {
            tools: {
              listChanged: true
            },
            resources: {
              subscribe: true,
              listChanged: true
            },
            prompts: {
              listChanged: true
            },
            logging: {
              level: "info"
            }
          },
          serverInfo: {
            name: "frappe-mcp-server",
            version: getVersion()
          },
          sessionId: session?.id
        };

        if (streaming) {
          sendSSE(res, { jsonrpc: "2.0", id, result });
          res.end();
        } else {
          res.json({ jsonrpc: "2.0", id, result });
        }
        break;
      }

      case 'tools/list': {
        const categories = getToolCategories();
        const toolCategories = categorizeTools();
        
        const toolList = Object.entries(tools).map(([name, tool]) => {
          // Find category for this tool
          let category = 'system';
          for (const [catName, toolNames] of Object.entries(toolCategories)) {
            if (toolNames.includes(name)) {
              category = catName;
              break;
            }
          }
          
          return {
          name,
          description: tool.description,
            inputSchema: zodToJsonSchema(tool.schema),
            category: category,
            categoryInfo: categories[category as keyof typeof categories]
          };
        });
        
        const result = { 
          tools: toolList,
          categories: categories,
          totalTools: toolList.length
        };

        if (streaming) {
          sendSSE(res, { jsonrpc: "2.0", id, result });
          res.end();
        } else {
          res.json({ jsonrpc: "2.0", id, result });
        }
        break;
      }

      case 'tools/call': {
        const { name: toolName, arguments: toolArgs = {}, _meta } = params;
        
        if (!toolName || !tools[toolName as keyof typeof tools]) {
          const error = {
            code: -32601,
            message: `Tool '${toolName}' not found`,
            data: { availableTools: Object.keys(tools) }
          };

          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, error });
            res.end();
          } else {
            res.status(404).json({ jsonrpc: "2.0", id, error });
          }
          return;
        }

        const toolDef = tools[toolName as keyof typeof tools];
        
        try {
          const validatedArgs = toolDef.schema.parse(toolArgs);
          
          if (streaming) {
            // Send progress updates for long-running operations
            sendSSE(res, {
              jsonrpc: "2.0",
              method: "tools/call/progress",
              params: {
                tool: toolName,
                status: "started"
              }
            });
          }

          const result = await toolDef.handler(validatedArgs);
          
          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, result });
            res.end();
          } else {
            res.json({ jsonrpc: "2.0", id, result });
          }
        } catch (error) {
          const errorResponse = {
            jsonrpc: "2.0",
            id,
            error: {
              code: error instanceof z.ZodError ? -32602 : -32603,
              message: error instanceof Error ? error.message : 'Internal error',
              data: error instanceof z.ZodError ? error.errors : undefined
            }
          };

          if (streaming) {
            sendSSE(res, errorResponse);
            res.end();
          } else {
            res.status(500).json(errorResponse);
          }
        }
        break;
      }

      case 'resources/list': {
        try {
          const resources = await listResources();
          const resourceCategories = getResourceCategories();
          
          const result = { 
            resources,
            categories: resourceCategories,
            totalResources: resources.length
          };

          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, result });
            res.end();
          } else {
            res.json({ jsonrpc: "2.0", id, result });
          }
        } catch (error) {
          const errorResponse = {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
              data: process.env.NODE_ENV === 'development' ? error : undefined
            }
          };

          if (streaming) {
            sendSSE(res, errorResponse);
            res.end();
          } else {
            res.status(500).json(errorResponse);
          }
        }
        break;
      }

      case 'resources/read': {
        const { uri } = params;
        
        if (!uri) {
          const error = {
            code: -32602,
            message: "Missing required parameter: uri"
          };

          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, error });
            res.end();
          } else {
            res.status(400).json({ jsonrpc: "2.0", id, error });
          }
          return;
        }

        try {
          const resource = await getResource(uri);
          
          if (!resource) {
            const error = {
              code: -32601,
              message: `Resource not found: ${uri}`
            };

            if (streaming) {
              sendSSE(res, { jsonrpc: "2.0", id, error });
              res.end();
            } else {
              res.status(404).json({ jsonrpc: "2.0", id, error });
            }
            return;
          }

          const result = { 
            contents: [resource]
          };

          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, result });
            res.end();
          } else {
            res.json({ jsonrpc: "2.0", id, result });
          }
        } catch (error) {
          const errorResponse = {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
              data: process.env.NODE_ENV === 'development' ? error : undefined
            }
          };

          if (streaming) {
            sendSSE(res, errorResponse);
            res.end();
          } else {
            res.status(500).json(errorResponse);
          }
        }
        break;
      }

      case 'prompts/list': {
        try {
          const prompts = await listPrompts();
          
          const result = { 
            prompts,
            totalPrompts: prompts.length
          };

          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, result });
            res.end();
          } else {
            res.json({ jsonrpc: "2.0", id, result });
          }
        } catch (error) {
          const errorResponse = {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
              data: process.env.NODE_ENV === 'development' ? error : undefined
            }
          };

          if (streaming) {
            sendSSE(res, errorResponse);
            res.end();
          } else {
            res.status(500).json(errorResponse);
          }
        }
        break;
      }

      case 'prompts/get': {
        const { name, arguments: promptArgs = {} } = params;
        
        if (!name) {
          const error = {
            code: -32602,
            message: "Missing required parameter: name"
          };

          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, error });
            res.end();
          } else {
            res.status(400).json({ jsonrpc: "2.0", id, error });
          }
          return;
        }

        try {
          const prompt = await getPrompt(name, promptArgs);
          
          if (!prompt) {
            const error = {
              code: -32601,
              message: `Prompt not found: ${name}`
            };

            if (streaming) {
              sendSSE(res, { jsonrpc: "2.0", id, error });
              res.end();
            } else {
              res.status(404).json({ jsonrpc: "2.0", id, error });
            }
            return;
          }

          const result = prompt;

          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, result });
            res.end();
          } else {
            res.json({ jsonrpc: "2.0", id, result });
          }
        } catch (error) {
          const errorResponse = {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
              data: process.env.NODE_ENV === 'development' ? error : undefined
            }
          };

          if (streaming) {
            sendSSE(res, errorResponse);
            res.end();
          } else {
            res.status(500).json(errorResponse);
          }
        }
        break;
      }

      case 'notifications/initialized': {
        // Handle client initialization notification
        logger.info(`Client initialized successfully`);
        
        if (streaming) {
          res.end();
        } else {
          res.status(204).end(); // No Content
        }
        break;
      }

      case 'notifications/message': {
        // Handle notifications (no response expected)
        if (id) {
          res.status(400).json({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32600,
              message: "Notifications should not include an id"
            }
          });
        } else {
          res.status(204).end(); // No content for notifications
        }
        break;
      }

      default: {
        const error = {
          code: -32601,
          message: `Method '${method}' not found`
        };

        if (streaming) {
          sendSSE(res, { jsonrpc: "2.0", id, error });
          res.end();
        } else {
          res.status(404).json({ jsonrpc: "2.0", id, error });
        }
      }
    }

  } catch (error) {
    logger.error('Error in Streamable HTTP handler:', error);
    
    const errorResponse = {
      jsonrpc: "2.0",
      id: req.body.id || null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    };

    if (res.headersSent) {
      // If we're streaming and headers are sent, send error via SSE
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.end();
    } else {
      res.status(500).json(errorResponse);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    server: 'frappe-mcp-server',
    version: getVersion(),
    transport: 'streamable-http',
    sessions: sessions.size
  });
});

// Server info endpoint
app.get('/info', (req, res) => {
  const toolNames = Object.keys(tools);
  const categories = getToolCategories();
  const toolCategories = categorizeTools();
  
  res.json({
    name: "frappe-mcp-server",
    version: getVersion(),
    transport: "streamable-http",
    protocol: "2025-06-18",
    capabilities: {
      streaming: true,
      stateful: true,
      rateLimit: process.env.NODE_ENV === 'production',
      authentication: !!process.env.MCP_API_KEY
    },
    tools: {
      total: toolNames.length,
      byCategory: Object.entries(toolCategories).reduce((acc, [cat, tools]) => {
        acc[cat] = tools.length;
        return acc;
      }, {} as Record<string, number>)
    },
    categories: categories,
    endpoints: {
      mcp: '/',
      health: '/health',
      info: '/info',
      metrics: '/metrics',
      tools: '/tools',
      resources: '/resources',
      prompts: '/prompts'
    }
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metricsData = getMetrics();
  res.json({
    ...metricsData,
    sessions: {
      ...metricsData.sessions,
      active: sessions.size
    },
    timestamp: new Date().toISOString()
  });
});

// Tools endpoint with detailed information
app.get('/tools', (req, res) => {
  const categories = getToolCategories();
  const toolCategories = categorizeTools();
  
  const toolsWithDetails = Object.entries(tools).map(([name, tool]) => {
    let category = 'system';
    for (const [catName, toolNames] of Object.entries(toolCategories)) {
      if (toolNames.includes(name)) {
        category = catName;
        break;
      }
    }
    
    return {
      name,
      description: tool.description,
      category,
      categoryInfo: categories[category as keyof typeof categories],
      inputSchema: zodToJsonSchema(tool.schema)
    };
  });
  
  res.json({
    tools: toolsWithDetails,
    categories: categories,
    summary: {
      total: toolsWithDetails.length,
      byCategory: Object.entries(toolCategories).reduce((acc, [cat, tools]) => {
        acc[cat] = tools.length;
        return acc;
      }, {} as Record<string, number>)
    }
  });
});

// Resources endpoint with detailed information
app.get('/resources', async (req, res) => {
  try {
    const resources = await listResources();
    const resourceCategories = getResourceCategories();
    
    res.json({
      resources: resources,
      categories: resourceCategories,
      summary: {
        total: resources.length,
        byCategory: Object.entries(resourceCategories).reduce((acc, [key, category]) => {
          acc[key] = resources.filter(r => r.uri.includes(key)).length;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    logger.error('Error listing resources:', error);
    res.status(500).json({ error: 'Failed to list resources' });
  }
});

// Prompts endpoint with detailed information  
app.get('/prompts', async (req, res) => {
  try {
    const prompts = await listPrompts();
    
    res.json({
      prompts: prompts,
      summary: {
        total: prompts.length,
        categories: ['workflow', 'analysis', 'troubleshooting', 'optimization', 'integration']
      }
    });
  } catch (error) {
    logger.error('Error listing prompts:', error);
    res.status(500).json({ error: 'Failed to list prompts' });
  }
});

// Add error handling middleware as the last middleware
app.use(errorHandlingMiddleware);

async function startServer() {
  try {
    logger.startup("Starting Frappe MCP Streamable HTTP server...");
    
    // Validate credentials
    await validateApiCredentials();
    logger.info("API credentials validation successful.");

    // Initialize components
    logger.info("Initializing static hints...");
    await initializeStaticHints();
    logger.info("Static hints initialized successfully");

    logger.info("Initializing app introspection...");
    await initializeAppIntrospection();
    logger.info("App introspection initialized successfully");

    // Start server
    app.listen(port, () => {
      const toolCount = Object.keys(tools).length;
      const categoryCount = Object.keys(getToolCategories()).length;
      
      logger.startup(`Frappe MCP Server v${getVersion()} running at http://localhost:${port}`);
      logger.server(`Port ${port} = 0xCAF1 in hexadecimal. The next evolution of Frappe Café! ☕`);
      
      logger.info(`📋 Available Endpoints:`);
      logger.info(`   POST /          - MCP Streamable HTTP (JSON-RPC 2.0)`);
      logger.info(`   GET  /health    - Health check & status`);
      logger.info(`   GET  /info      - Server information`);
      logger.info(`   GET  /metrics   - Performance metrics`);
      logger.info(`   GET  /tools     - Tool documentation`);
      logger.info(`   GET  /resources - Available resources`);
      logger.info(`   GET  /prompts   - Available prompts`);
      
      logger.info(`\n🔧 Loaded Tools: ${toolCount} tools in ${categoryCount} categories`);
      const toolCategories = categorizeTools();
      Object.entries(toolCategories).forEach(([category, tools]) => {
        const categoryInfo = getToolCategories()[category as keyof ReturnType<typeof getToolCategories>];
        logger.info(`   ${categoryInfo?.icon || '📦'} ${categoryInfo?.name || category}: ${tools.length} tools`);
      });
      
      logger.info(`\n✨ Features:`);
      logger.info(`   🚀 Streamable HTTP transport with optional SSE`);
      logger.info(`   🎯 Stateful sessions with automatic cleanup`);
      logger.info(`   📊 Real-time metrics and monitoring`);
      logger.info(`   🔒 Rate limiting and security headers`);
      logger.info(`   🏷️ Categorized tools with proper schemas`);
      logger.info(`   📝 Comprehensive request logging`);
      
      if (process.env.NODE_ENV === 'production') {
        logger.info(`\n🛡️ Production Mode:`);
        logger.info(`   ⚡ Rate limiting: 100 requests/minute`);
        logger.info(`   🔐 API key authentication: ${process.env.MCP_API_KEY ? 'enabled' : 'disabled'}`);
        logger.info(`   🌐 CORS: Restricted to known origins`);
      } else {
        logger.info(`\n🧪 Development Mode:`);
        logger.info(`   📝 Debug logging enabled`);
        logger.info(`   🌐 CORS: Open to all origins`);
        logger.info(`   🚫 Rate limiting disabled`);
      }
    });

  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down Frappe MCP Streamable HTTP server...');
  sessions.clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down Frappe MCP Streamable HTTP server...');
  sessions.clear();
  process.exit(0);
});

// Add type declaration for session
declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

startServer();