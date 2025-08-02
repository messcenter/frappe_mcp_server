import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { frappe } from './api-client.js';
import { FrappeApiError, handleApiError } from './errors.js';
import { callMethod, listDocuments } from './document-api.js';

export function setupReportTools(server: McpServer) {
  // Run a query report (like P&L, Balance Sheet, etc.)
  server.tool(
    "run_query_report",
    "Execute a Frappe query report with filters",
    {
      report_name: z.string().describe("Name of the report to run"),
      filters: z.object({}).optional().describe("Filters to apply to the report (optional)"),
      user: z.string().optional().describe("User to run report as (optional)")
    },
    async (args) => {
      try {
        console.error(`Running query report: ${args.report_name}`);
        
        const response = await callMethod('frappe.desk.query_report.run', {
          report_name: args.report_name,
          filters: args.filters || {},
          user: args.user
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        return handleApiError(error, 'run_query_report');
      }
    }
  );

  // Get report metadata (columns, filters, etc.)
  server.tool(
    "get_report_meta",
    "Get metadata for a specific report including columns and filters",
    {
      report_name: z.string().describe("Name of the report to get metadata for")
    },
    async (args) => {
      try {
        console.error(`Getting report metadata: ${args.report_name}`);
        
        const response = await callMethod('frappe.desk.query_report.get_report_meta', {
          report_name: args.report_name
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        return handleApiError(error, 'get_report_meta');
      }
    }
  );

  // List available reports
  server.tool(
    "list_reports",
    "Get a list of all available reports in the system",
    {
      module: z.string().optional().describe("Filter reports by module (optional)")
    },
    async (args) => {
      try {
        console.error(`Listing reports${args.module ? ` for module: ${args.module}` : ''}`);
        
        // Get all Report DocType records
        const filters: any = { disabled: 0 };
        if (args.module) {
          filters.module = args.module;
        }

        const response = await listDocuments('Report', {
          fields: ['name', 'report_name', 'report_type', 'ref_doctype', 'module', 'is_standard'],
          filters: filters,
          limit_page_length: 1000
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        return handleApiError(error, 'list_reports');
      }
    }
  );

  // Export report in various formats
  server.tool(
    "export_report",
    "Export a report in PDF, Excel, or CSV format",
    {
      report_name: z.string().describe("Name of the report to export"),
      file_format: z.enum(['PDF', 'Excel', 'CSV']).describe("Export format"),
      filters: z.object({}).optional().describe("Filters to apply to the report (optional)"),
      visible_idx: z.array(z.number()).optional().describe("Visible column indices (optional)")
    },
    async (args) => {
      try {
        console.error(`Exporting report: ${args.report_name} as ${args.file_format}`);
        
        const response = await callMethod('frappe.desk.query_report.export_query', {
          report_name: args.report_name,
          file_format_type: args.file_format,
          filters: args.filters || {},
          visible_idx: args.visible_idx
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        return handleApiError(error, 'export_report');
      }
    }
  );

  // Get financial reports specifically
  server.tool(
    "get_financial_statements",
    "Get standard financial reports (P&L, Balance Sheet, Cash Flow)",
    {
      report_type: z.enum(['Profit and Loss Statement', 'Balance Sheet', 'Cash Flow']).describe("Type of financial statement"),
      company: z.string().describe("Company name"),
      from_date: z.string().describe("Start date (YYYY-MM-DD)"),
      to_date: z.string().describe("End date (YYYY-MM-DD)"),
      periodicity: z.enum(['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly']).optional().describe("Period frequency (optional)"),
      include_default_book_entries: z.boolean().optional().describe("Include default book entries (optional)")
    },
    async (args) => {
      try {
        console.error(`Getting financial statement: ${args.report_type} for ${args.company}`);
        
        const filters = {
          company: args.company,
          from_date: args.from_date,
          to_date: args.to_date,
          periodicity: args.periodicity || 'Yearly',
          include_default_book_entries: args.include_default_book_entries || true
        };

        const response = await callMethod('frappe.desk.query_report.run', {
          report_name: args.report_type,
          filters: filters
        });

        return {
          content: [{
            type: "text", 
            text: JSON.stringify(response.data, null, 2)
          }]
        };
      } catch (error) {
        return handleApiError(error, 'get_financial_statements');
      }
    }
  );

  // Get report columns for a specific report
  server.tool(
    "get_report_columns",
    "Get the column structure for a specific report",
    {
      report_name: z.string().describe("Name of the report"),
      filters: z.object({}).optional().describe("Filters to determine dynamic columns (optional)")
    },
    async (args) => {
      try {
        console.error(`Getting columns for report: ${args.report_name}`);
        
        const response = await callMethod('frappe.desk.query_report.get_columns', {
          report_name: args.report_name,
          filters: args.filters || {}
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        return handleApiError(error, 'get_report_columns');
      }
    }
  );

  // Run standard doctype reports (List View reports)
  server.tool(
    "run_doctype_report", 
    "Run a standard doctype report with filters and sorting",
    {
      doctype: z.string().describe("DocType to generate report for"),
      fields: z.array(z.string()).optional().describe("Fields to include in report (optional)"),
      filters: z.object({}).optional().describe("Filters to apply (optional)"),
      order_by: z.string().optional().describe("Field to order by (optional)"),
      limit: z.number().optional().describe("Maximum number of records (optional)")
    },
    async (args) => {
      try {
        console.error(`Running doctype report for: ${args.doctype}`);
        
        const options: any = {};
        if (args.fields) options.fields = args.fields;
        if (args.filters) options.filters = args.filters;
        if (args.order_by) options.order_by = args.order_by;
        if (args.limit) options.limit_page_length = args.limit;

        const response = await listDocuments(args.doctype, options);

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        return handleApiError(error, 'run_doctype_report');
      }
    }
  );
}