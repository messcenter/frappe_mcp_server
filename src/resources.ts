/**
 * MCP Resources implementation for Frappe
 * Provides context and documentation as resources
 */

import { logger } from './logger.js';
import { getDocTypeSchema } from './frappe-api.js';
import { getModuleList, findDocTypes } from './frappe-helpers.js';
import { getDocTypeHints } from './static-hints.js';
import { getInstructions } from './frappe-instructions.js';

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: {
    audience?: string[];
    priority?: number;
  };
}

export interface ResourceContent {
  uri: string;
  text?: string;
  blob?: string;
  mimeType: string;
}

// Resource categories for Frappe
const RESOURCE_CATEGORIES = {
  schemas: {
    name: "DocType Schemas",
    description: "Frappe DocType field definitions and validation rules",
    icon: "🏗️"
  },
  documentation: {
    name: "API Documentation", 
    description: "Frappe API usage guides and examples",
    icon: "📚"
  },
  workflows: {
    name: "Business Workflows",
    description: "Predefined business process templates",
    icon: "🔄"
  },
  modules: {
    name: "Module Information",
    description: "Frappe app modules and their DocTypes",
    icon: "📦"
  },
  examples: {
    name: "Code Examples",
    description: "Ready-to-use code snippets and templates",
    icon: "💡"
  }
};

export async function listResources(): Promise<Resource[]> {
  const resources: Resource[] = [];

  try {
    // 1. DocType Schemas
    const modules = await getModuleList();
    for (const module of modules.slice(0, 10)) { // Limit for performance
      const doctypes = await findDocTypes("", { module, limit: 5 });
      for (const doctype of doctypes) {
        resources.push({
          uri: `frappe://schema/${doctype.name}`,
          name: `${doctype.name} Schema`,
          description: `Complete field definitions and validation rules for ${doctype.name}`,
          mimeType: "application/json",
          annotations: {
            audience: ["developer", "analyst"],
            priority: doctype.is_custom ? 2 : 1
          }
        });
      }
    }

    // 2. API Documentation Resources
    const apiCategories = ["DOCUMENT_OPERATIONS", "SCHEMA_OPERATIONS", "ADVANCED_OPERATIONS", "BEST_PRACTICES"];
    const apiOperations = ["CREATE", "GET", "UPDATE", "DELETE", "LIST", "SEARCH"];
    
    for (const category of apiCategories) {
      resources.push({
        uri: `frappe://docs/api/${category.toLowerCase()}`,
        name: `${category.replace(/_/g, ' ')} Guide`,
        description: `Comprehensive guide for ${category.toLowerCase().replace(/_/g, ' ')}`,
        mimeType: "text/markdown",
        annotations: {
          audience: ["developer"],
          priority: 1
        }
      });
      
      for (const operation of apiOperations) {
        try {
          const instructions = getInstructions(category, operation);
          if (instructions && instructions.length > 100) { // Only add if substantial content
            resources.push({
              uri: `frappe://docs/api/${category.toLowerCase()}/${operation.toLowerCase()}`,
              name: `${operation} ${category.replace(/_/g, ' ')}`,
              description: `Detailed instructions for ${operation.toLowerCase()} operations`,
              mimeType: "text/markdown",
              annotations: {
                audience: ["developer"],
                priority: 2
              }
            });
          }
        } catch (error) {
          // Skip if instructions not available
        }
      }
    }

    // 3. Module Documentation
    for (const module of modules.slice(0, 8)) {
      resources.push({
        uri: `frappe://module/${module}`,
        name: `${module} Module`,
        description: `DocTypes and functionality in the ${module} module`,
        mimeType: "application/json",
        annotations: {
          audience: ["developer", "analyst", "user"],
          priority: 1
        }
      });
    }

    // 4. Common Workflow Examples
    const commonWorkflows = [
      {
        name: "Customer Onboarding",
        description: "Step-by-step customer creation and setup process",
        uri: "frappe://workflow/customer-onboarding"
      },
      {
        name: "Sales Order Processing", 
        description: "Complete sales order to invoice workflow",
        uri: "frappe://workflow/sales-order-processing"
      },
      {
        name: "Purchase Requisition",
        description: "Purchase request to purchase order workflow",
        uri: "frappe://workflow/purchase-requisition"
      },
      {
        name: "Employee Management",
        description: "Employee lifecycle management processes",
        uri: "frappe://workflow/employee-management"
      }
    ];

    for (const workflow of commonWorkflows) {
      resources.push({
        uri: workflow.uri,
        name: workflow.name,
        description: workflow.description,
        mimeType: "text/markdown",
        annotations: {
          audience: ["user", "analyst"],
          priority: 1
        }
      });
    }

    // 5. Code Examples
    const codeExamples = [
      {
        name: "REST API Examples",
        description: "Common Frappe REST API usage patterns",
        uri: "frappe://examples/rest-api"
      },
      {
        name: "DocType Customization",
        description: "Custom field and form scripting examples", 
        uri: "frappe://examples/doctype-customization"
      },
      {
        name: "Report Generation",
        description: "Query and script report examples",
        uri: "frappe://examples/reports"
      },
      {
        name: "Integration Patterns",
        description: "Common integration and webhook patterns",
        uri: "frappe://examples/integrations"
      }
    ];

    for (const example of codeExamples) {
      resources.push({
        uri: example.uri,
        name: example.name,
        description: example.description,
        mimeType: "text/markdown",
        annotations: {
          audience: ["developer"],
          priority: 2
        }
      });
    }

    logger.info(`Generated ${resources.length} resources`);
    return resources;

  } catch (error) {
    logger.error('Error listing resources:', error);
    return [];
  }
}

export async function getResource(uri: string): Promise<ResourceContent | null> {
  try {
    const url = new URL(uri);
    
    if (url.protocol !== 'frappe:') {
      throw new Error('Invalid resource URI - must use frappe:// protocol');
    }

    const pathParts = url.pathname.split('/').filter(p => p);
    const category = pathParts[0];

    switch (category) {
      case 'schema': {
        const doctypeName = pathParts[1];
        if (!doctypeName) {
          throw new Error('DocType name required for schema resource');
        }

        const schema = await getDocTypeSchema(doctypeName);
        const hints = getDocTypeHints(doctypeName);
        
        const content = {
          doctype: doctypeName,
          schema: schema,
          hints: hints,
          generated_at: new Date().toISOString(),
          usage_notes: `This schema defines the structure and validation rules for ${doctypeName} documents`
        };

        return {
          uri,
          text: JSON.stringify(content, null, 2),
          mimeType: "application/json"
        };
      }

      case 'docs': {
        const subcategory = pathParts[1]; // 'api'
        const category = pathParts[2]?.toUpperCase(); // 'DOCUMENT_OPERATIONS'
        const operation = pathParts[3]?.toUpperCase(); // 'CREATE'

        if (subcategory === 'api' && category) {
          if (operation) {
            // Specific operation instructions
            const instructions = getInstructions(category, operation);
            return {
              uri,
              text: instructions,
              mimeType: "text/markdown"
            };
          } else {
            // Category overview
            const categoryInstructions = getInstructions(category, 'OVERVIEW');
            return {
              uri,
              text: categoryInstructions || `# ${category.replace(/_/g, ' ')}\n\nComprehensive guide for ${category.toLowerCase().replace(/_/g, ' ')}.`,
              mimeType: "text/markdown"
            };
          }
        }
        break;
      }

      case 'module': {
        const moduleName = pathParts[1];
        if (!moduleName) {
          throw new Error('Module name required');
        }

        const doctypes = await findDocTypes("", { module: moduleName });
        const content = {
          module: moduleName,
          doctypes: doctypes,
          summary: `The ${moduleName} module contains ${doctypes.length} DocTypes`,
          generated_at: new Date().toISOString()
        };

        return {
          uri,
          text: JSON.stringify(content, null, 2),
          mimeType: "application/json"
        };
      }

      case 'workflow':
      case 'examples': {
        // Return predefined workflow/example content
        const workflowContent = await generateWorkflowContent(uri, pathParts[1]);
        return {
          uri,
          text: workflowContent,
          mimeType: "text/markdown"
        };
      }

      default:
        throw new Error(`Unknown resource category: ${category}`);
    }

    return null;

  } catch (error) {
    logger.error(`Error getting resource ${uri}:`, error);
    return null;
  }
}

async function generateWorkflowContent(uri: string, workflowType: string): Promise<string> {
  const workflows: Record<string, string> = {
    'customer-onboarding': `# Customer Onboarding Workflow

## Overview
Complete process for onboarding new customers in Frappe.

## Steps

### 1. Create Customer
\`\`\`json
{
  "doctype": "Customer",
  "customer_name": "ABC Corporation",
  "customer_type": "Company",
  "territory": "All Territories",
  "customer_group": "Commercial"
}
\`\`\`

### 2. Set Up Address
\`\`\`json
{
  "doctype": "Address",
  "address_title": "ABC Corporation",
  "address_type": "Billing",
  "address_line1": "123 Business Street",
  "city": "Business City",
  "country": "United States"
}
\`\`\`

### 3. Configure Contact
\`\`\`json
{
  "doctype": "Contact",
  "first_name": "John",
  "last_name": "Doe",
  "email_id": "john@abc.com",
  "phone": "+1-555-0123"
}
\`\`\`

### 4. Set Credit Terms
Configure payment terms and credit limits in the Customer document.

## Best Practices
- Always verify customer information before creation
- Set appropriate credit limits based on business requirements
- Link addresses and contacts properly for accurate communication
`,

    'sales-order-processing': `# Sales Order Processing Workflow

## Overview
End-to-end process from quotation to invoice.

## Workflow Steps

### 1. Create Quotation
\`\`\`json
{
  "doctype": "Quotation", 
  "party_name": "Customer Name",
  "items": [{
    "item_code": "ITEM-001",
    "qty": 10,
    "rate": 100
  }]
}
\`\`\`

### 2. Convert to Sales Order
After quotation approval, convert to Sales Order.

### 3. Create Delivery Note
\`\`\`json
{
  "doctype": "Delivery Note",
  "customer": "Customer Name",
  "items": [{
    "item_code": "ITEM-001", 
    "qty": 10,
    "against_sales_order": "SO-001"
  }]
}
\`\`\`

### 4. Generate Sales Invoice
Final step to complete the sale and request payment.

## Status Tracking
- Draft → Submitted → Delivered → Paid
`,

    'rest-api': `# Frappe REST API Examples

## Authentication
\`\`\`bash
export FRAPPE_API_KEY="your_api_key"
export FRAPPE_API_SECRET="your_api_secret"
\`\`\`

## Common Operations

### Get Document
\`\`\`bash
curl -X GET "https://your-site.com/api/resource/Customer/CUST-001" \\
  -H "Authorization: token $FRAPPE_API_KEY:$FRAPPE_API_SECRET"
\`\`\`

### Create Document
\`\`\`bash
curl -X POST "https://your-site.com/api/resource/Customer" \\
  -H "Authorization: token $FRAPPE_API_KEY:$FRAPPE_API_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "New Customer",
    "customer_type": "Individual"
  }'
\`\`\`

### Update Document
\`\`\`bash
curl -X PUT "https://your-site.com/api/resource/Customer/CUST-001" \\
  -H "Authorization: token $FRAPPE_API_KEY:$FRAPPE_API_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "Updated Customer Name"
  }'
\`\`\`

### List Documents with Filters
\`\`\`bash
curl -X GET "https://your-site.com/api/resource/Customer?filters=[[\\"customer_type\\",\\"=\\",\\"Company\\"]]" \\
  -H "Authorization: token $FRAPPE_API_KEY:$FRAPPE_API_SECRET"
\`\`\`
`,

    'doctype-customization': `# DocType Customization Examples

## Custom Fields
\`\`\`javascript
// Add custom field via Custom Field doctype
{
  "doctype": "Custom Field",
  "dt": "Customer",
  "fieldname": "custom_rating", 
  "label": "Customer Rating",
  "fieldtype": "Select",
  "options": "Excellent\\nGood\\nAverage\\nPoor"
}
\`\`\`

## Client Script Examples
\`\`\`javascript
// Client script for Customer form
frappe.ui.form.on('Customer', {
  refresh: function(frm) {
    if (frm.doc.customer_type === 'Company') {
      frm.set_df_property('tax_id', 'reqd', 1);
    }
  },
  
  customer_type: function(frm) {
    if (frm.doc.customer_type === 'Individual') {
      frm.set_value('territory', 'Rest Of The World');
    }
  }
});
\`\`\`

## Server Script Examples
\`\`\`python
# Server script for Customer validation
def validate(doc, method):
    if doc.customer_type == "Company" and not doc.tax_id:
        frappe.throw("Tax ID is mandatory for Company customers")
\`\`\`
`
  };

  return workflows[workflowType] || `# ${workflowType}\n\nDocumentation for ${workflowType} workflow.`;
}

export function getResourceCategories() {
  return RESOURCE_CATEGORIES;
}