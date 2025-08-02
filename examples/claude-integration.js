// Example of how to use the Frappe MCP Server with Claude
// This is a pseudocode example to illustrate the integration

// 1. First, ensure the Frappe MCP Server is configured in your Claude settings
// Add the following to your Claude MCP settings file:
/*
{
  "mcpServers": {
    "frappe": {
      "command": "node",
      "args": ["/path/to/frappe-mcp-server/build/index.js"],
      "env": {
        "FRAPPE_URL": "http://frappe:8000",
        "FRAPPE_API_KEY": "ebd0f67ed8867c8",
        "FRAPPE_API_SECRET": "712b361980f1eb0"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
*/

// 2. Example of using the MCP server with Claude

// Example 1: Get DocType Schema
/*
You: Can you show me the schema for the Customer DocType in our Frappe system?

Claude: I'll retrieve the schema for the Customer DocType from your Frappe system.

<use_mcp_tool>
<server_name>frappe</server_name>
<tool_name>get_doctype_schema</tool_name>
<arguments>
{
  "doctype": "Customer"
}
</arguments>
</use_mcp_tool>

You: [Result of the MCP tool call with the Customer schema]

Claude: Here's the schema for the Customer DocType:
[Claude would then format and explain the schema information]
*/

// Example 2: Create a new Customer
/*
You: Please create a new customer named "Acme Corporation" in our Frappe system.

Claude: I'll create a new customer record for "Acme Corporation" in your Frappe system.

<use_mcp_tool>
<server_name>frappe</server_name>
<tool_name>create_document</tool_name>
<arguments>
{
  "doctype": "Customer",
  "values": {
    "customer_name": "Acme Corporation",
    "customer_type": "Company",
    "customer_group": "Commercial",
    "territory": "All Territories"
  }
}
</arguments>
</use_mcp_tool>

You: [Result of the MCP tool call with the created customer information]

Claude: I've successfully created a new customer record for "Acme Corporation" in your Frappe system.
The customer has been assigned the ID: CUST-00123.
*/

// Example 3: List Customers with Filters
/*
You: Can you list all customers in the Commercial customer group?

Claude: I'll retrieve a list of all customers in the Commercial customer group.

<use_mcp_tool>
<server_name>frappe</server_name>
<tool_name>list_documents</tool_name>
<arguments>
{
  "doctype": "Customer",
  "filters": {
    "customer_group": "Commercial"
  }
}
</arguments>
</use_mcp_tool>

You: [Result of the MCP tool call with the list of customers]

Claude: Here are the customers in the Commercial customer group:
1. Acme Corporation (CUST-00123)
2. XYZ Industries (CUST-00089)
3. ABC Enterprises (CUST-00045)
[Claude would continue listing and might provide additional insights]
*/

// Example 4: Update a Customer
/*
You: Please update the customer "Acme Corporation" to change their territory to "North America".

Claude: I'll update the customer record for "Acme Corporation" to change their territory.

<use_mcp_tool>
<server_name>frappe</server_name>
<tool_name>update_document</tool_name>
<arguments>
{
  "doctype": "Customer",
  "name": "CUST-00123",
  "values": {
    "territory": "North America"
  }
}
</arguments>
</use_mcp_tool>

You: [Result of the MCP tool call with the updated customer information]

Claude: I've successfully updated the customer record for "Acme Corporation".
Their territory has been changed to "North America".
*/