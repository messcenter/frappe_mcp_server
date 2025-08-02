/**
 * Test Script for Usage Information Enhancement
 * 
 * This script tests the combined usage information functionality that integrates:
 * 1. Frappe metadata (schema)
 * 2. Static hints
 * 3. Custom app introspection
 * 
 * Run with: node test-usage-info.js
 */

import axios from 'axios';

// Configuration
const SERVER_URL = 'http://localhost:3000'; // Adjust if your server runs on a different port
const API_ENDPOINT = `${SERVER_URL}/api/v1/tools/call`;

// Helper function to call the MCP server tools
async function callTool(toolName, args) {
  try {
    console.log(`\n=== Calling ${toolName} ===`);
    console.log('Arguments:', JSON.stringify(args, null, 2));
    
    const response = await axios.post(API_ENDPOINT, {
      name: toolName,
      arguments: args
    });
    
    // Extract the text content from the response
    const textContent = response.data.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
    
    console.log('\nResponse:');
    console.log('-------------------------------------------');
    console.log(textContent);
    console.log('-------------------------------------------');
    
    return textContent;
  } catch (error) {
    console.error('Error calling tool:', error.response?.data || error.message);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('Starting Usage Information Enhancement Tests');
  
  // Test 1: Core Frappe DocType (User)
  // This should primarily return schema information
  await callTool('get_frappe_usage_info', {
    doctype: 'User'
  });
  
  // Test 2: DocType with static hints (Sales Order)
  // This should return both schema and static hints
  await callTool('get_frappe_usage_info', {
    doctype: 'Sales Order'
  });
  
  // Test 3: Workflow defined in static hints
  // This should return workflow information from static hints
  await callTool('get_frappe_usage_info', {
    workflow: 'Quote to Sales Order Conversion'
  });
  
  // Test 4: EpiStart DocType (using custom app introspection)
  // This should return app-provided instructions
  await callTool('get_frappe_usage_info', {
    doctype: 'Venture'
  });
  
  // Test 5: App-level instructions for EpiStart
  // This should return app-level instructions
  await callTool('get_frappe_usage_info', {
    doctype: 'EpiStart'
  });
  
  console.log('\nAll tests completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
});