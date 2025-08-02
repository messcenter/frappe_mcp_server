/**
 * Schema generator utility for converting Zod schemas to JSON Schema format
 * Used for MCP tool input validation
 */

import { z } from 'zod';

export function zodToJsonSchema(zodSchema: z.ZodType): any {
  if (zodSchema instanceof z.ZodObject) {
    const shape = zodSchema.shape;
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType);
      if (!(value as any).isOptional()) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
      $schema: "http://json-schema.org/draft-07/schema#"
    };
  }

  if (zodSchema instanceof z.ZodString) {
    const schema: any = { type: "string" };
    if ((zodSchema as any)._def.description) {
      schema.description = (zodSchema as any)._def.description;
    }
    return schema;
  }

  if (zodSchema instanceof z.ZodNumber) {
    const schema: any = { type: "number" };
    if ((zodSchema as any)._def.description) {
      schema.description = (zodSchema as any)._def.description;
    }
    return schema;
  }

  if (zodSchema instanceof z.ZodBoolean) {
    const schema: any = { type: "boolean" };
    if ((zodSchema as any)._def.description) {
      schema.description = (zodSchema as any)._def.description;
    }
    return schema;
  }

  if (zodSchema instanceof z.ZodArray) {
    const schema: any = {
      type: "array",
      items: zodToJsonSchema(zodSchema.element)
    };
    if ((zodSchema as any)._def.description) {
      schema.description = (zodSchema as any)._def.description;
    }
    return schema;
  }

  if (zodSchema instanceof z.ZodEnum) {
    const schema: any = {
      type: "string",
      enum: zodSchema.options
    };
    if ((zodSchema as any)._def.description) {
      schema.description = (zodSchema as any)._def.description;
    }
    return schema;
  }

  if (zodSchema instanceof z.ZodRecord) {
    const schema: any = {
      type: "object",
      properties: {},
      additionalProperties: (zodSchema as any)._def.valueType ? zodToJsonSchema((zodSchema as any)._def.valueType) : true
    };
    if ((zodSchema as any)._def.description) {
      schema.description = (zodSchema as any)._def.description;
    }
    return schema;
  }

  if (zodSchema instanceof z.ZodOptional) {
    return zodToJsonSchema(zodSchema.unwrap());
  }

  if (zodSchema instanceof z.ZodUnion) {
    return {
      anyOf: zodSchema.options.map((option: z.ZodType) => zodToJsonSchema(option))
    };
  }

  // Fallback for unknown types
  return {
    type: "object",
    properties: {},
    additionalProperties: true
  };
}

export function getToolCategories() {
  return {
    "document": {
      name: "Document Operations",
      description: "Create, read, update, delete documents in Frappe",
      icon: "📄"
    },
    "schema": {
      name: "Schema Operations", 
      description: "Get DocType schemas, field options, and metadata",
      icon: "🏗️"
    },
    "helper": {
      name: "Helper Tools",
      description: "Utility functions for system exploration",
      icon: "🔧"
    },
    "report": {
      name: "Report Operations",
      description: "Generate and export reports from Frappe",
      icon: "📊"
    },
    "system": {
      name: "System Tools",
      description: "Server information and system utilities",
      icon: "⚙️"
    }
  };
}

export function categorizeTools() {
  return {
    document: [
      "create_document", "get_document", "update_document", 
      "delete_document", "list_documents", "reconcile_bank_transaction_with_vouchers"
    ],
    schema: [
      "get_doctype_schema", "get_field_options", "get_frappe_usage_info"
    ],
    helper: [
      "find_doctypes", "get_module_list", "get_doctypes_in_module",
      "check_doctype_exists", "check_document_exists", "get_document_count",
      "get_naming_info", "get_required_fields", "get_api_instructions"
    ],
    report: [
      "run_query_report", "get_report_meta", "list_reports", "export_report",
      "get_financial_statements", "get_report_columns", "run_doctype_report"
    ],
    system: [
      "ping", "version", "call_method"
    ]
  };
}