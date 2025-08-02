# Design: Static Hint Mechanism for frappe-mcp-server

**Version:** 1.0
**Date:** 2025-04-18

## 1. Introduction

This document outlines the design for a static hint mechanism within the `frappe-mcp-server`. These hints augment the metadata retrieved dynamically via the `get_doctype_schema` tool, providing supplementary context, instructions, and workflow guidance specifically tailored for Large Language Model (LLM) consumption.

## 2. Goals

- Provide additional, LLM-friendly context for specific Frappe DocTypes.
- Describe common or complex multi-DocType workflows.
- Offer guidance for modules or scenarios where standard descriptions might be insufficient.
- Ensure the hint system is maintainable and easy to update.

## 3. Storage Mechanism

- **Location:** Hints will be stored within a dedicated directory in the `frappe-mcp-server` project: `frappe-mcp-server/static_hints/`.
- **Format:** Each hint or logical group of hints (e.g., all hints for a specific module or complex workflow) will be stored in a separate JSON file within this directory (e.g., `sales_hints.json`, `hr_onboarding_workflow.json`). This approach facilitates modularity, maintainability, and easier version control tracking.
- **Naming Convention:** Filenames should be descriptive (e.g., `doctype_item.json`, `workflow_quote_to_cash.json`).

## 4. Hint Structure / JSON Schema

We will define a common structure for hints. Each JSON file in the `static_hints/` directory will contain an array of hint objects.

```json
// Example File: static_hints/sales_hints.json
[
  {
    "type": "doctype",
    "target": "Sales Order",
    "hint": "A Sales Order confirms a sale to a customer. It typically follows a Quotation and precedes a Delivery Note and Sales Invoice. Key fields include 'customer', 'transaction_date', 'delivery_date', and the 'items' table detailing products/services, quantities, and rates. Use this document to lock in the terms of a sale before fulfillment."
  },
  {
    "type": "doctype",
    "target": "Quotation",
    "hint": "A Quotation is an offer sent to a potential customer for goods or services. If accepted, it can be converted into a Sales Order. Focus on accurately capturing customer requirements and pricing."
  },
  {
    "type": "workflow",
    "target": "Quote to Sales Order Conversion",
    "id": "WF-SAL-001", // Optional unique ID for the workflow hint
    "description": "Guidance on converting an accepted Quotation into a Sales Order.",
    "steps": [
      "Ensure the Quotation status is 'Accepted' or relevant.",
      "Use the 'Create > Sales Order' button/action directly from the accepted Quotation form.",
      "Verify the details automatically copied to the new Sales Order, especially items, quantities, rates, and customer information.",
      "Save and Submit the Sales Order to confirm it."
    ],
    "related_doctypes": ["Quotation", "Sales Order"]
  }
]
```

**Schema Definition:**

- **`type`** (string, required): Specifies the hint type. Allowed values:
  - `"doctype"`: The hint applies to a specific DocType.
  - `"workflow"`: The hint describes a business process or task, potentially involving multiple DocTypes.
- **`target`** (string, required): Identifies what the hint applies to.
  - If `type` is `"doctype"`, this is the exact name of the DocType (e.g., `"Sales Order"`).
  - If `type` is `"workflow"`, this is a descriptive name for the workflow (e.g., `"Quote to Sales Order Conversion"`).
- **`hint`** (string, required if `type` is `"doctype"`): The instructional text or supplementary description for the DocType, aimed at the LLM.
- **`id`** (string, optional, recommended if `type` is `"workflow"`): A unique identifier for the workflow hint (e.g., `"WF-SAL-001"`).
- **`description`** (string, optional, recommended if `type` is `"workflow"`): A brief description of the workflow's purpose.
- **`steps`** (array of strings, required if `type` is `"workflow"`): An ordered list of steps or instructions describing the workflow.
- **`related_doctypes`** (array of strings, optional, recommended if `type` is `"workflow"`): A list of DocType names relevant to this workflow.

## 5. Access Logic

1.  **Loading:** On server startup, `frappe-mcp-server` will scan the `static_hints/` directory.
2.  **Parsing & Indexing:** It will parse all `*.json` files found within the directory. The hints will be loaded into memory and indexed for efficient retrieval. A potential in-memory structure could be:

    ```typescript
    interface Hint {
      type: "doctype" | "workflow";
      target: string;
      hint?: string;
      id?: string;
      description?: string;
      steps?: string[];
      related_doctypes?: string[];
    }

    // Indexed structure
    const staticHints: {
      doctype: Map<string, Hint[]>; // Keyed by DocType name
      workflow: Map<string, Hint[]>; // Keyed by workflow name or ID
    } = {
      doctype: new Map(),
      workflow: new Map(),
    };
    ```

    Hints would be added to the appropriate map based on their `type` and `target`. Multiple hints can exist for the same target.

3.  **Retrieval:** When the server needs context (e.g., before calling `get_doctype_schema` or when asked about a workflow), it will query this in-memory index using the DocType name or a potential workflow identifier/keywords.
4.  **Merging:** The retrieved static hints can then be combined with the dynamic information obtained from `get_doctype_schema` to provide a richer context to the LLM. For workflows, the static hint might be the primary source of information.

## 6. Example Hint (Illustrative)

**File:** `static_hints/manufacturing_hints.json`

```json
[
  {
    "type": "doctype",
    "target": "Bill Of Materials",
    "hint": "A Bill Of Materials (BOM) defines the raw materials, sub-assemblies, intermediate assemblies, sub-components, parts, and the quantities of each needed to manufacture an end product. It is crucial for production planning, costing, and inventory management. Ensure the quantities are accurate for the specified manufacturing quantity (usually 1 unit of the final product)."
  },
  {
    "type": "workflow",
    "target": "Basic Production Cycle",
    "id": "WF-MFG-001",
    "description": "Simplified workflow for creating a finished good using a Work Order based on a Bill of Materials.",
    "steps": [
      "Ensure a 'Bill Of Materials' exists for the item to be produced.",
      "Create a 'Work Order' specifying the item code and quantity to produce. The system should fetch the required materials from the BOM.",
      "Issue raw materials against the Work Order using a 'Stock Entry' of type 'Material Issue'.",
      "Once production is complete, create another 'Stock Entry' of type 'Manufacture' to receive the finished goods into inventory. This consumes the issued raw materials based on the Work Order.",
      "Complete the 'Work Order'."
    ],
    "related_doctypes": [
      "Bill Of Materials",
      "Work Order",
      "Stock Entry",
      "Item"
    ]
  }
]
```

## 7. Considerations

- **Maintainability:** As Frappe/ERPNext evolves, these hints may need updates. The file-based approach aids this.
- **Scope:** Hints should focus on _how_ to use Frappe effectively, not replicate basic field descriptions readily available via schema introspection, unless adding significant LLM-specific value.
- **Discovery:** The server might need logic to intelligently match user queries to relevant workflow hints (e.g., using keywords from the query against workflow targets, descriptions, or related DocTypes).
