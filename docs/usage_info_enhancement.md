# Usage Information Enhancement for frappe-mcp-server

**Version:** 1.0
**Date:** 2025-04-18

## 1. Introduction

This document describes the Usage Information Enhancement for `frappe-mcp-server`, which combines three sources of information to provide comprehensive, LLM-friendly context about Frappe DocTypes and workflows:

1. **Frappe Metadata**: Schema information retrieved directly from the Frappe API
2. **Static Hints**: Supplementary context stored in JSON files within the MCP server
3. **Custom App Introspection**: Usage instructions provided directly by custom Frappe apps

This enhancement enables Large Language Models (LLMs) to better understand Frappe modules, making them more effective at assisting users with Frappe-based applications.

## 2. Overall Architecture

The Usage Information Enhancement is implemented as a layered system that combines information from multiple sources:

```
┌─────────────────────────────────────────────────────────────┐
│                  get_frappe_usage_info Tool                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Information Sources                       │
├─────────────────┬─────────────────────┬─────────────────────┤
│ Frappe Metadata │    Static Hints     │  App Introspection  │
│  (Schema API)   │  (JSON files in     │  (Custom app API    │
│                 │   static_hints/)    │   endpoints)        │
└─────────────────┴─────────────────────┴─────────────────────┘
```

### 2.1 Component Responsibilities

1. **Frappe Metadata (Schema API)**

   - Provides structural information about DocTypes
   - Includes field definitions, validations, and relationships
   - Source of truth for technical details

2. **Static Hints**

   - Provides supplementary context and usage guidance
   - Describes workflows that span multiple DocTypes
   - Maintained within the MCP server codebase

3. **Custom App Introspection**

   - Allows apps to provide their own usage instructions
   - Enables app-specific guidance without modifying the MCP server
   - Maintained by app developers

4. **Integration Layer (`get_frappe_usage_info` Tool)**
   - Combines information from all three sources
   - Formats the combined information in a consistent, LLM-friendly way
   - Handles fallbacks when certain sources are unavailable

## 3. Information Flow

When the `get_frappe_usage_info` tool is called:

1. If a DocType is specified:

   - The system attempts to retrieve schema information from the Frappe API
   - It looks for static hints related to the DocType
   - It checks if the DocType belongs to a custom app and retrieves app-provided instructions
   - It combines all available information into a comprehensive response

2. If a workflow is specified:
   - The system looks for static hints related to the workflow
   - It formats the workflow information in a consistent way

## 4. Implementation Details

### 4.1 Static Hints

Static hints are stored as JSON files in the `static_hints/` directory. Each file contains an array of hint objects with the following structure:

```json
{
  "type": "doctype",
  "target": "Sales Order",
  "hint": "A Sales Order confirms a sale to a customer..."
}
```

or for workflows:

```json
{
  "type": "workflow",
  "target": "Quote to Sales Order Conversion",
  "description": "Guidance on converting an accepted Quotation into a Sales Order.",
  "steps": [
    "Ensure the Quotation status is 'Accepted' or relevant.",
    "Use the 'Create > Sales Order' button/action directly from the accepted Quotation form.",
    "..."
  ],
  "related_doctypes": ["Quotation", "Sales Order"]
}
```

The system loads these hints at startup and indexes them for efficient retrieval.

### 4.2 Custom App Introspection

Custom apps can provide their own usage instructions by implementing a standardized API endpoint:

```python
@frappe.whitelist()
def get_usage_instructions(doctype=None):
    # Return app-level or DocType-specific instructions
```

The MCP server discovers these endpoints dynamically and calls them when needed.

### 4.3 Integration

The integration happens in the `get_frappe_usage_info` tool implementation in `schema-operations.ts`. This tool:

1. Retrieves information from all available sources
2. Formats the combined information in a consistent, markdown-based format
3. Handles errors and fallbacks gracefully

## 5. When to Use Each Approach

### 5.1 Frappe Metadata (Schema API)

Use the schema API for:

- Technical details about DocTypes and fields
- Field validations and constraints
- Relationships between DocTypes

This is the source of truth for structural information and should not be duplicated in other sources.

### 5.2 Static Hints

Use static hints for:

- General usage guidance that applies to all installations
- Descriptions of common workflows that span multiple DocTypes
- Supplementary context that helps LLMs understand Frappe concepts

Static hints are maintained within the MCP server codebase and are appropriate for information that is common across all Frappe installations.

### 5.3 Custom App Introspection

Use custom app introspection for:

- App-specific usage guidance
- Instructions for custom DocTypes
- Workflows specific to a particular app

This approach allows app developers to provide their own guidance without modifying the MCP server.

## 6. Examples for LLM Usage

### 6.1 Understanding a DocType

When an LLM needs to understand a DocType, it can use the combined information to:

1. Understand the technical structure from the schema
2. Learn about common usage patterns from static hints
3. Get app-specific guidance from custom app introspection

For example, for a "Sales Order" DocType:

- The schema provides field definitions and validations
- Static hints explain its role in the sales process
- App introspection might provide company-specific policies

### 6.2 Guiding a User Through a Workflow

When an LLM needs to guide a user through a workflow, it can:

1. Retrieve the workflow steps from static hints
2. Understand the involved DocTypes from their schemas
3. Incorporate app-specific guidance if available

For example, for a "Quote to Sales Order Conversion" workflow:

- Static hints provide the step-by-step process
- Schema information helps understand the fields to fill
- App introspection might provide company-specific requirements

## 7. Future Enhancements

Potential future enhancements to the system include:

1. **Contextual Hints**: Provide different hints based on the user's role or context
2. **Interactive Tutorials**: Generate step-by-step tutorials based on the combined information
3. **Usage Analytics**: Track which hints are most useful and refine them over time
4. **Community-Contributed Hints**: Allow the community to contribute hints for common DocTypes and workflows
5. **Multilingual Support**: Provide hints in multiple languages
6. **Versioned Hints**: Maintain different hints for different versions of Frappe/ERPNext

## 8. Conclusion

The Usage Information Enhancement significantly improves the ability of LLMs to understand and work with Frappe-based applications. By combining information from multiple sources, it provides a comprehensive view that includes both technical details and usage guidance.

This approach is flexible and extensible, allowing for both centralized maintenance of common information (via static hints) and distributed maintenance of app-specific information (via custom app introspection).
