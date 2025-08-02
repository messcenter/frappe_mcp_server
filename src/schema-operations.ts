import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getDocTypeSchema,
  getFieldOptions,
  FrappeApiError,
  getAllDocTypes,
  getAllModules
} from "./frappe-api.js";
import { formatFilters } from "./frappe-helpers.js";
import {
  getDocTypeHints,
  getWorkflowHints,
  findWorkflowsForDocType,
  initializeStaticHints
} from "./static-hints.js";
import {
  getDocTypeUsageInstructions,
  getAppForDocType,
  getAppUsageInstructions,
  initializeAppIntrospection
} from "./app-introspection.js";

// Define schema tools
// SCHEMA_TOOLS array removed - now using modern MCP SDK API with server.tool() registration

/**
 * Format error response with detailed information
 */
function formatErrorResponse(error: any, operation: string): any {
  console.error(`Error in ${operation}:`, error);

  let errorMessage = `Error in ${operation}: ${error.message || 'Unknown error'}`;
  let errorDetails = null;

  if (error instanceof FrappeApiError) {
    errorMessage = error.message;
    errorDetails = {
      statusCode: error.statusCode,
      endpoint: error.endpoint,
      details: error.details
    };
  }

  return {
    content: [
      {
        type: "text",
        text: errorMessage,
      },
      ...(errorDetails ? [
        {
          type: "text",
          text: `\nDetails: ${JSON.stringify(errorDetails, null, 2)}`,
        }
      ] : [])
    ],
    isError: true,
  };
}

// Export a handler function for schema tool calls
export async function handleSchemaToolCall(request: any): Promise<any> {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [
        {
          type: "text",
          text: "Missing arguments for tool call",
        },
      ],
      isError: true,
    };
  }

  try {
    console.error(`Handling schema tool: ${name} with args:`, args);

    if (name === "get_doctype_schema") {
      const doctype = args.doctype as string;
      if (!doctype) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameter: doctype",
            },
          ],
          isError: true,
        };
      }

      try {
        let schema;
        let authMethod = "token";

        // Get schema using API key/secret authentication
        schema = await getDocTypeSchema(doctype);
        console.error(`Retrieved schema for ${doctype} using API key/secret auth`);
        authMethod = "api_key";

        // Add a summary of the schema for easier understanding
        const fieldTypes = schema.fields.reduce((acc: Record<string, number>, field: any) => {
          acc[field.fieldtype] = (acc[field.fieldtype] || 0) + 1;
          return acc;
        }, {});

        const requiredFields = schema.fields
          .filter((field: any) => field.required)
          .map((field: any) => field.fieldname);

        const summary = {
          name: schema.name,
          module: schema.module,
          isSingle: schema.issingle,
          isTable: schema.istable,
          isCustom: schema.custom,
          autoname: schema.autoname,
          fieldCount: schema.fields.length,
          fieldTypes: fieldTypes,
          requiredFields: requiredFields,
          permissions: schema.permissions.length,
          authMethod: authMethod
        };

        return {
          content: [
            {
              type: "text",
              text: `Schema Summary (retrieved using ${authMethod} authentication):\n${JSON.stringify(summary, null, 2)}\n\nFull Schema:\n${JSON.stringify(schema, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `get_doctype_schema(${doctype})`);
      }
    } else if (name === "get_field_options") {
      const doctype = args.doctype as string;
      const fieldname = args.fieldname as string;

      if (!doctype || !fieldname) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameters: doctype and fieldname are required",
            },
          ],
          isError: true,
        };
      }

      const filters = args.filters as Record<string, any> | undefined;
      const formattedFilters = filters ? formatFilters(filters) : undefined;

      try {
        // First get the field metadata to understand what we're dealing with
        const schema = await getDocTypeSchema(doctype);
        const field = schema.fields.find((f: any) => f.fieldname === fieldname);

        if (!field) {
          return {
            content: [
              {
                type: "text",
                text: `Field ${fieldname} not found in DocType ${doctype}`,
              },
            ],
            isError: true,
          };
        }

        // Get the options
        const options = await getFieldOptions(doctype, fieldname, formattedFilters);

        // Add field metadata to the response
        const fieldInfo = {
          fieldname: field.fieldname,
          label: field.label,
          fieldtype: field.fieldtype,
          required: field.required,
          description: field.description,
          options: field.options,
        };

        return {
          content: [
            {
              type: "text",
              text: `Field Information:\n${JSON.stringify(fieldInfo, null, 2)}\n\nAvailable Options (${options.length}):\n${JSON.stringify(options, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `get_field_options(${doctype}, ${fieldname})`);
      }
    } else if (name === "get_frappe_usage_info") {
      const doctype = args.doctype as string;
      const workflow = args.workflow as string;

      if (!doctype && !workflow) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameters: either doctype or workflow must be provided",
            },
          ],
          isError: true,
        };
      }

      try {
        // Initialize result object
        const result: any = {
          type: doctype ? "doctype" : "workflow",
          name: doctype || workflow,
          schema: null,
          hints: [],
          related_workflows: [],
          app_instructions: null
        };

        // If doctype is provided, get the schema, doctype hints, and app instructions
        if (doctype) {
          try {
            // Get schema
            result.schema = await getDocTypeSchema(doctype);
            
            // Get static hints
            result.hints = getDocTypeHints(doctype);
            result.related_workflows = findWorkflowsForDocType(doctype);
            
            // Get app-provided instructions
            result.app_instructions = await getDocTypeUsageInstructions(doctype);
            
            // If no app instructions but we have the app name, try to get app-level instructions
            if (!result.app_instructions) {
              const appName = await getAppForDocType(doctype);
              if (appName) {
                result.app_name = appName;
                result.app_level_instructions = await getAppUsageInstructions(appName);
              }
            }
          } catch (error) {
            console.error(`Error getting schema for DocType ${doctype}:`, error);
            // Continue even if schema retrieval fails, we can still provide hints
            result.schema_error = `Error retrieving schema: ${(error as Error).message}`;
          }
        } else if (workflow) {
          // If workflow is provided, get the workflow hints
          result.hints = getWorkflowHints(workflow);
        }

        // Format the response
        let responseText = "";

        if (doctype) {
          responseText += `# DocType: ${doctype}\n\n`;
          
          // Add app-provided instructions if available
          if (result.app_instructions) {
            const instructions = result.app_instructions.instructions;
            
            responseText += "## App-Provided Usage Information\n\n";
            
            if (instructions.description) {
              responseText += `### Description\n\n${instructions.description}\n\n`;
            }
            
            if (instructions.usage_guidance) {
              responseText += `### Usage Guidance\n\n${instructions.usage_guidance}\n\n`;
            }
            
            if (instructions.key_fields && instructions.key_fields.length > 0) {
              responseText += "### Key Fields\n\n";
              for (const field of instructions.key_fields) {
                responseText += `- **${field.name}**: ${field.description}\n`;
              }
              responseText += "\n";
            }
            
            if (instructions.common_workflows && instructions.common_workflows.length > 0) {
              responseText += "### Common Workflows\n\n";
              instructions.common_workflows.forEach((workflow: string, index: number) => {
                responseText += `${index + 1}. ${workflow}\n`;
              });
              responseText += "\n";
            }
          }
          
          // Add static hints if available
          if (result.hints && result.hints.length > 0) {
            responseText += "## Static Hints\n\n";
            for (const hint of result.hints) {
              responseText += `${hint.hint}\n\n`;
            }
          }
          
          // If no specific instructions were found, but we have app-level instructions
          if (!result.app_instructions && result.app_level_instructions) {
            responseText += `## About ${result.app_name}\n\n`;
            
            const appInstructions = result.app_level_instructions;
            
            if (appInstructions.app_description) {
              responseText += `${appInstructions.app_description}\n\n`;
            }
            
            // Add a note that this DocType is part of this app
            responseText += `The DocType "${doctype}" is part of the ${result.app_name} app.\n\n`;
          }
          
          // Add schema summary if available
          if (result.schema) {
            const fieldTypes = result.schema.fields.reduce((acc: Record<string, number>, field: any) => {
              acc[field.fieldtype] = (acc[field.fieldtype] || 0) + 1;
              return acc;
            }, {});

            const requiredFields = result.schema.fields
              .filter((field: any) => field.required)
              .map((field: any) => field.fieldname);

            responseText += "## Schema Summary\n\n";
            responseText += `- **Module**: ${result.schema.module}\n`;
            responseText += `- **Is Single**: ${result.schema.issingle ? "Yes" : "No"}\n`;
            responseText += `- **Is Table**: ${result.schema.istable ? "Yes" : "No"}\n`;
            responseText += `- **Is Custom**: ${result.schema.custom ? "Yes" : "No"}\n`;
            responseText += `- **Field Count**: ${result.schema.fields.length}\n`;
            responseText += `- **Field Types**: ${JSON.stringify(fieldTypes)}\n`;
            responseText += `- **Required Fields**: ${requiredFields.join(", ")}\n\n`;
          } else if (result.schema_error) {
            responseText += `## Schema Error\n\n${result.schema_error}\n\n`;
          }
          
          // Add related workflows if available
          if (result.related_workflows && result.related_workflows.length > 0) {
            responseText += "## Related Workflows\n\n";
            for (const workflow of result.related_workflows) {
              responseText += `### ${workflow.target}\n\n`;
              if (workflow.description) {
                responseText += `${workflow.description}\n\n`;
              }
              if (workflow.steps && workflow.steps.length > 0) {
                responseText += "Steps:\n";
                workflow.steps.forEach((step: string, index: number) => {
                  responseText += `${index + 1}. ${step}\n`;
                });
                responseText += "\n";
              }
            }
          }
        } else if (workflow) {
          responseText += `# Workflow: ${workflow}\n\n`;
          
          // Add workflow hints if available
          if (result.hints && result.hints.length > 0) {
            for (const hint of result.hints) {
              if (hint.description) {
                responseText += `## Description\n\n${hint.description}\n\n`;
              }
              
              if (hint.steps && hint.steps.length > 0) {
                responseText += "## Steps\n\n";
                hint.steps.forEach((step: string, index: number) => {
                  responseText += `${index + 1}. ${step}\n`;
                });
                responseText += "\n";
              }
              
              if (hint.related_doctypes && hint.related_doctypes.length > 0) {
                responseText += "## Related DocTypes\n\n";
                responseText += hint.related_doctypes.join(", ") + "\n\n";
              }
            }
          } else {
            responseText += "No workflow information available.\n";
          }
        }

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `get_frappe_usage_info(${doctype || workflow})`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Schema operations module doesn't handle tool: ${name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    return formatErrorResponse(error, `schema_operations.${name}`);
  }
}

export function setupSchemaTools(server: McpServer): void {
  // Initialize static hints
  console.error("Initializing static hints...");
  initializeStaticHints().then(() => {
    console.error("Static hints initialized successfully");
  }).catch(error => {
    console.error("Error initializing static hints:", error);
  });
  
  // Initialize app introspection
  console.error("Initializing app introspection...");
  initializeAppIntrospection().then(() => {
    console.error("App introspection initialized successfully");
  }).catch(error => {
    console.error("Error initializing app introspection:", error);
  });

  // Register get_doctype_schema tool
  server.tool(
    "get_doctype_schema",
    "Get the complete schema for a DocType including field definitions, validations, and linked DocTypes. Use this to understand the structure of a DocType before creating or updating documents.",
    {
      doctype: z.string().describe("DocType name")
    },
    async ({ doctype }) => {
      try {
        const schema = await getDocTypeSchema(doctype);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(schema, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, "get_doctype_schema");
      }
    }
  );

  // Register get_field_options tool
  server.tool(
    "get_field_options",
    "Get available options for a Link or Select field. For Link fields, returns documents from the linked DocType. For Select fields, returns the predefined options.",
    {
      doctype: z.string().describe("DocType name"),
      fieldname: z.string().describe("Field name"),
      filters: z.object({}).optional().describe("Filters to apply to the linked DocType (optional, for Link fields only)")
    },
    async ({ doctype, fieldname, filters }) => {
      try {
        const options = await getFieldOptions(doctype, fieldname, filters);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(options, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, "get_field_options");
      }
    }
  );

  // Register get_frappe_usage_info tool
  server.tool(
    "get_frappe_usage_info",
    "Get combined information about a DocType or workflow, including schema metadata and usage guidance from static hints.",
    {
      doctype: z.string().optional().describe("DocType name (optional if workflow is provided)"),
      workflow: z.string().optional().describe("Workflow name (optional if doctype is provided)")
    },
    async ({ doctype, workflow }) => {
      try {
        let result = {};
        
        if (doctype) {
          const schema = await getDocTypeSchema(doctype);
          const hints = await getDocTypeHints(doctype);
          const workflows = await findWorkflowsForDocType(doctype);
          const appName = await getAppForDocType(doctype);
          const appInstructions = appName ? getAppUsageInstructions(appName) : null;
          const docTypeInstructions = getDocTypeUsageInstructions(doctype);
          
          result = {
            doctype,
            schema,
            hints,
            workflows,
            app: appName,
            appInstructions,
            docTypeInstructions
          };
        } else if (workflow) {
          const workflowHints = await getWorkflowHints(workflow);
          result = {
            workflow,
            hints: workflowHints
          };
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, "get_frappe_usage_info");
      }
    }
  );

  // Schema resources are not currently needed for the MCP implementation
  // All schema functionality is provided through tools
  // Resources can be added in future versions if needed
}