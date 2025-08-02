# Custom App Introspection for frappe-mcp-server

**Version:** 1.0
**Date:** 2025-04-18

## 1. Introduction

This document describes the custom app introspection mechanism for `frappe-mcp-server`. This feature allows custom Frappe apps to provide their own usage instructions directly to the MCP server, enabling app developers to include LLM-friendly instructions within their apps rather than requiring updates to the static hints in `frappe-mcp-server`.

## 2. Overview

The custom app introspection mechanism works as follows:

1. When the `get_frappe_usage_info` tool is called with a DocType name, the server checks if the DocType belongs to a custom app.
2. If it does, the server attempts to call a standardized API endpoint in the app to retrieve usage instructions.
3. If the app implements this endpoint, the returned instructions are combined with static hints and schema metadata.
4. If the app doesn't implement the endpoint, the server falls back to static hints and schema metadata.

## 3. Implementing the API in Custom Apps

To provide custom usage instructions for your Frappe app, follow these steps:

### 3.1. Create the API File

Create a file named `api_usage.py` in your app's Python package directory. For example:

```
your_app/
  your_app/
    api_usage.py  # Create this file
```

### 3.2. Implement the API Endpoint

In `api_usage.py`, implement a whitelisted method called `get_usage_instructions` that accepts an optional `doctype` parameter:

```python
import frappe

@frappe.whitelist()
def get_usage_instructions(doctype=None):
    """
    Returns usage instructions for your app or a specific DocType.

    Args:
        doctype (str, optional): The DocType name to get instructions for.
            If not provided, returns app-level instructions.

    Returns:
        dict: A dictionary containing usage instructions
    """
    if not doctype:
        # Return app-level instructions
        return {
            "app_name": "Your App Name",
            "app_description": "Description of your app's purpose and functionality",
            "main_workflows": [
                {
                    "name": "Workflow Name",
                    "description": "Description of the workflow",
                    "steps": [
                        "Step 1 description",
                        "Step 2 description",
                        # ...
                    ],
                    "related_doctypes": ["DocType1", "DocType2"]
                }
            ],
            "key_concepts": [
                {
                    "name": "Concept Name",
                    "description": "Description of the concept"
                }
            ]
        }

    # DocType-specific instructions
    doctype_instructions = {
        "YourDocType": {
            "description": "Description of the DocType's purpose",
            "usage_guidance": "Guidance on how to use this DocType effectively",
            "key_fields": [
                {"name": "field_name", "description": "Description of the field's purpose"},
                # ...
            ],
            "common_workflows": [
                "Workflow step 1",
                "Workflow step 2",
                # ...
            ]
        }
    }

    if doctype in doctype_instructions:
        return {
            "doctype": doctype,
            "instructions": doctype_instructions[doctype]
        }

    # If the requested DocType doesn't have specific instructions
    return {
        "doctype": doctype,
        "instructions": {
            "description": f"Generic description for {doctype}",
            "usage_guidance": "Generic usage guidance"
        }
    }
```

### 3.3. Response Format

#### App-Level Instructions (when `doctype` is not provided)

```json
{
  "app_name": "Your App Name",
  "app_description": "Description of your app's purpose and functionality",
  "main_workflows": [
    {
      "name": "Workflow Name",
      "description": "Description of the workflow",
      "steps": ["Step 1 description", "Step 2 description"],
      "related_doctypes": ["DocType1", "DocType2"]
    }
  ],
  "key_concepts": [
    {
      "name": "Concept Name",
      "description": "Description of the concept"
    }
  ]
}
```

#### DocType-Specific Instructions (when `doctype` is provided)

```json
{
  "doctype": "YourDocType",
  "instructions": {
    "description": "Description of the DocType's purpose",
    "usage_guidance": "Guidance on how to use this DocType effectively",
    "key_fields": [
      {
        "name": "field_name",
        "description": "Description of the field's purpose"
      }
    ],
    "common_workflows": ["Workflow step 1", "Workflow step 2"]
  }
}
```

## 4. How It Works

### 4.1. DocType to App Mapping

The server determines which app a DocType belongs to by:

1. Querying the DocType to get its module
2. Querying the module to get its app name

This mapping is cached for performance.

### 4.2. API Discovery

The server checks if an app implements the usage instructions API by attempting to call the `get_usage_instructions` method. If the method exists, the app is considered to have implemented the API.

### 4.3. Caching

For performance reasons, the server caches:

- DocType to app mappings
- App-level usage instructions
- DocType-specific usage instructions

The cache is cleared periodically to ensure fresh data.

## 5. Example Implementation

See the `epistart` app for a reference implementation:

```
frappe-bench/apps/epistart/epistart/api_usage.py
```

This implementation provides usage instructions for the EpiStart app and its key DocTypes related to lean startup methodology.

## 6. Best Practices

1. **Focus on LLM-Friendly Content**: Write instructions that help LLMs understand how to use your app effectively.
2. **Provide Context**: Include descriptions of your app's purpose, key concepts, and workflows.
3. **Be Specific**: For DocType instructions, include specific guidance on how to use the DocType effectively.
4. **Keep Updated**: Update your instructions as your app evolves.
5. **Prioritize Important DocTypes**: Focus on providing detailed instructions for the most important DocTypes in your app.

## 7. Troubleshooting

If your app's instructions are not being picked up:

1. Ensure the `api_usage.py` file is in the correct location
2. Verify that the `get_usage_instructions` method is properly whitelisted
3. Check that the method returns data in the expected format
4. Look for errors in the frappe-mcp-server logs
