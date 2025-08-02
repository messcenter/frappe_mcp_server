import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  findDocTypes,
  getModuleList,
  getDocTypesInModule,
  doesDocTypeExist,
  doesDocumentExist,
  getDocumentCount,
  getNamingSeriesInfo,
  getRequiredFields
} from "./frappe-helpers.js";
import { getInstructions } from "./frappe-instructions.js";

/**
 * Format error response with detailed information
 */
function formatErrorResponse(error: any, operation: string): any {
  console.error(`Error in ${operation}:`, error);
  
  return {
    content: [
      {
        type: "text",
        text: `Error in ${operation}: ${error.message || 'Unknown error'}`,
      },
    ],
    isError: true,
  };
}

export function setupHelperTools(server: McpServer): void {
  // Register find_doctypes tool
  server.tool(
    "find_doctypes",
    "Find DocTypes in the system matching a search term",
    {
      search_term: z.string().optional().describe("Search term to look for in DocType names"),
      module: z.string().optional().describe("Filter by module name (optional)"),
      is_table: z.boolean().optional().describe("Filter by table DocTypes (optional)"),
      is_single: z.boolean().optional().describe("Filter by single DocTypes (optional)"),
      is_custom: z.boolean().optional().describe("Filter by custom DocTypes (optional)"),
      limit: z.number().optional().describe("Maximum number of results (optional, default 20)")
    },
    async ({ search_term, module, is_table, is_single, is_custom, limit }) => {
      try {
        const searchTerm = search_term || "";
        const options = {
          module,
          isTable: is_table,
          isSingle: is_single,
          isCustom: is_custom,
          limit: limit || 20
        };
        const doctypes = await findDocTypes(searchTerm, options);
        return {
          content: [
            {
              type: "text",
              text: `Found ${doctypes.length} DocTypes:\n\n` + doctypes.map(doctype => 
                `• ${doctype.name} (${doctype.module})${doctype.description ? ' - ' + doctype.description : ''}${doctype.istable ? ' [Table]' : ''}${doctype.issingle ? ' [Single]' : ''}`
              ).join('\n')
            }
          ]
        };
      } catch (error) {
        return formatErrorResponse(error, "find_doctypes");
      }
    }
  );

  // Register get_module_list tool
  server.tool(
    "get_module_list",
    "Get a list of all modules in the system",
    {},
    async () => {
      try {
        const modules = await getModuleList();
        return {
          content: [
            {
              type: "text",
              text: `Frappe Modules (${modules.length} total):\n\n` + modules.map(m => `• ${m}`).join('\n')
            }
          ]
        };
      } catch (error) {
        return formatErrorResponse(error, "get_module_list");
      }
    }
  );

  // Register get_doctypes_in_module tool
  server.tool(
    "get_doctypes_in_module",
    "Get a list of DocTypes in a specific module",
    {
      module: z.string().describe("Module name")
    },
    async ({ module }) => {
      try {
        const doctypes = await getDocTypesInModule(module);
        return {
          content: [
            {
              type: "list",
              items: doctypes.map(doctype => ({
                type: "text",
                text: `${doctype.name} (${doctype.module})${doctype.description ? ' - ' + doctype.description : ''}`
              }))
            }
          ]
        };
      } catch (error) {
        return formatErrorResponse(error, "get_doctypes_in_module");
      }
    }
  );

  // Register check_doctype_exists tool
  server.tool(
    "check_doctype_exists",
    "Check if a DocType exists in the system",
    {
      doctype: z.string().describe("DocType name to check")
    },
    async ({ doctype }) => {
      try {
        const exists = await doesDocTypeExist(doctype);
        return {
          content: [{ type: "text", text: JSON.stringify({ exists }, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error, "check_doctype_exists");
      }
    }
  );

  // Register check_document_exists tool
  server.tool(
    "check_document_exists",
    "Check if a document exists",
    {
      doctype: z.string().describe("DocType name"),
      name: z.string().describe("Document name to check")
    },
    async ({ doctype, name }) => {
      try {
        const exists = await doesDocumentExist(doctype, name);
        return {
          content: [{ type: "text", text: JSON.stringify({ exists }, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error, "check_document_exists");
      }
    }
  );

  // Register get_document_count tool
  server.tool(
    "get_document_count",
    "Get a count of documents matching filters",
    {
      doctype: z.string().describe("DocType name"),
      filters: z.object({}).optional().describe("Filters to apply (optional)")
    },
    async ({ doctype, filters }) => {
      try {
        const count = await getDocumentCount(doctype, filters);
        return {
          content: [{ type: "text", text: JSON.stringify({ count }, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error, "get_document_count");
      }
    }
  );

  // Register get_naming_info tool
  server.tool(
    "get_naming_info",
    "Get the naming series information for a DocType",
    {
      doctype: z.string().describe("DocType name")
    },
    async ({ doctype }) => {
      try {
        const namingInfo = await getNamingSeriesInfo(doctype);
        return {
          content: [{ type: "text", text: JSON.stringify(namingInfo, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error, "get_naming_info");
      }
    }
  );

  // Register get_required_fields tool
  server.tool(
    "get_required_fields",
    "Get a list of required fields for a DocType",
    {
      doctype: z.string().describe("DocType name")
    },
    async ({ doctype }) => {
      try {
        const requiredFields = await getRequiredFields(doctype);
        return {
          content: [{ type: "text", text: JSON.stringify(requiredFields, null, 2) }],
        };
      } catch (error) {
        return formatErrorResponse(error, "get_required_fields");
      }
    }
  );

  // Register get_api_instructions tool
  server.tool(
    "get_api_instructions",
    "Get detailed instructions for using the Frappe API",
    {
      category: z.string().describe("Instruction category (DOCUMENT_OPERATIONS, SCHEMA_OPERATIONS, ADVANCED_OPERATIONS, BEST_PRACTICES)"),
      operation: z.string().describe("Operation name (e.g., CREATE, GET, UPDATE, DELETE, LIST, GET_DOCTYPE_SCHEMA, etc.)")
    },
    async ({ category, operation }) => {
      try {
        const instructions = getInstructions(category, operation);
        return {
          content: [{ type: "text", text: instructions }],
        };
      } catch (error) {
        return formatErrorResponse(error, "get_api_instructions");
      }
    }
  );
}