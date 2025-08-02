#!/usr/bin/env node

/**
 * Debug script to test MCP server filter handling
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMcpFiltering() {
  console.log('🚀 Starting MCP Server for filter testing...');
  
  // Create MCP client
  const transport = new StdioClientTransport({
    command: 'node',
    args: [join(__dirname, 'build/index.js')],
    env: {
      ...process.env,
      FRAPPE_URL: 'https://epinomy.com',
      FRAPPE_API_KEY: 'ff09790d111aeab',
      FRAPPE_API_SECRET: 'd3bc10957fd898f',
    }
  });

  const client = new Client({
    name: 'filter-test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Test 1: No filters
    console.log('\n=== Test 1: No filters ===');
    const response1 = await client.callTool('list_documents', {
      doctype: 'Contact',
      fields: ['name', 'first_name', 'email_id'],
      limit: 3
    });
    
    console.log('Response status:', response1.isError ? 'ERROR' : 'SUCCESS');
    if (response1.content && response1.content[0]) {
      try {
        const docs1 = JSON.parse(response1.content[0].text.split(':\n\n')[1] || response1.content[0].text);
        console.log('Documents found:', Array.isArray(docs1) ? docs1.length : 'Not an array');
        if (Array.isArray(docs1) && docs1.length > 0) {
          console.log('Sample:', docs1[0]);
        }
      } catch (e) {
        console.log('Raw response:', response1.content[0].text);
      }
    }

    // Test 2: Simple object filters
    console.log('\n=== Test 2: Object filters ===');
    const response2 = await client.callTool('list_documents', {
      doctype: 'Contact',
      fields: ['name', 'first_name', 'email_id'],
      filters: { "first_name": "Aaron" },
      limit: 5
    });
    
    console.log('Response status:', response2.isError ? 'ERROR' : 'SUCCESS');
    if (response2.content && response2.content[0]) {
      try {
        const docs2 = JSON.parse(response2.content[0].text.split(':\n\n')[1] || response2.content[0].text);
        console.log('Documents found:', Array.isArray(docs2) ? docs2.length : 'Not an array');
        if (Array.isArray(docs2) && docs2.length > 0) {
          console.log('Sample:', docs2[0]);
        }
      } catch (e) {
        console.log('Raw response:', response2.content[0].text);
      }
    }

    // Test 3: Operator filters
    console.log('\n=== Test 3: Operator filters ===');
    const response3 = await client.callTool('list_documents', {
      doctype: 'Contact',
      fields: ['name', 'first_name', 'email_id'],
      filters: { "first_name": ["=", "Aaron"] },
      limit: 5
    });
    
    console.log('Response status:', response3.isError ? 'ERROR' : 'SUCCESS');
    if (response3.content && response3.content[0]) {
      try {
        const docs3 = JSON.parse(response3.content[0].text.split(':\n\n')[1] || response3.content[0].text);
        console.log('Documents found:', Array.isArray(docs3) ? docs3.length : 'Not an array');
        if (Array.isArray(docs3) && docs3.length > 0) {
          console.log('Sample:', docs3[0]);
        }
      } catch (e) {
        console.log('Raw response:', response3.content[0].text);
      }
    }

    // Test 4: LIKE filters
    console.log('\n=== Test 4: LIKE filters ===');
    const response4 = await client.callTool('list_documents', {
      doctype: 'Contact',
      fields: ['name', 'first_name', 'email_id'],
      filters: { "first_name": ["like", "%George%"] },
      limit: 5
    });
    
    console.log('Response status:', response4.isError ? 'ERROR' : 'SUCCESS');
    if (response4.content && response4.content[0]) {
      try {
        const docs4 = JSON.parse(response4.content[0].text.split(':\n\n')[1] || response4.content[0].text);
        console.log('Documents found:', Array.isArray(docs4) ? docs4.length : 'Not an array');
        if (Array.isArray(docs4) && docs4.length > 0) {
          console.log('Sample:', docs4[0]);
        }
      } catch (e) {
        console.log('Raw response:', response4.content[0].text);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.close();
  }
}

testMcpFiltering().catch(console.error);