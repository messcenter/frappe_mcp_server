#!/usr/bin/env node

/**
 * Real Frappe Integration Test
 * 
 * Tests the MCP server against a real Frappe instance.
 * Requires environment variables or command line args for connection.
 * 
 * Usage:
 *   FRAPPE_URL=https://demo.frappe.cloud FRAPPE_TOKEN=your-token node test-with-real-frappe.js
 *   
 * Or:
 *   node test-with-real-frappe.js --url https://demo.frappe.cloud --token your-token
 */

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class RealFrappeTest {
  constructor(frappeUrl, frappeApiKey, frappeApiSecret) {
    this.frappeUrl = frappeUrl;
    this.frappeApiKey = frappeApiKey;
    this.frappeApiSecret = frappeApiSecret;
    this.client = null;
    this.serverProcess = null;
  }

  async setup() {
    console.log('🚀 Starting MCP Server for real Frappe testing...');
    
    // Create MCP client using the proper StdioClientTransport pattern
    const transport = new StdioClientTransport({
      command: 'node',
      args: [join(__dirname, 'build/index.js')],
      env: {
        ...process.env,
        FRAPPE_URL: this.frappeUrl,
        FRAPPE_API_KEY: this.frappeApiKey,
        FRAPPE_API_SECRET: this.frappeApiSecret,
      }
    });

    this.client = new Client({
      name: 'test-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    await this.client.connect(transport);
    console.log('✅ Connected to MCP server');
  }

  async cleanup() {
    if (this.client) {
      await this.client.close();
    }
  }

  async runTest(name, testFn) {
    try {
      console.log(`\n🧪 Running: ${name}`);
      await testFn();
      console.log(`✅ ${name} - PASSED`);
      return true;
    } catch (error) {
      console.error(`❌ ${name} - FAILED:`, error.message);
      return false;
    }
  }

  async testBasicConnectivity() {
    await this.runTest('Basic Server Connectivity', async () => {
      // Add timeout for individual test
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout after 30s')), 30000)
      );
      
      const testPromise = this.client.callTool('ping', {});
      
      const response = await Promise.race([testPromise, timeoutPromise]);
      if (!response.content || response.content[0].text !== 'pong') {
        throw new Error('Server ping failed');
      }
    });
  }

  async testDocTypeOperations() {
    await this.runTest('Find DocTypes', async () => {
      const response = await this.client.callTool('find_doctypes', {
        search_term: 'User',
        limit: 5
      });
      
      if (!response.content || !response.content[0].text) {
        throw new Error('No response from find_doctypes');
      }
      
      const docTypes = JSON.parse(response.content[0].text);
      if (!Array.isArray(docTypes) || docTypes.length === 0) {
        throw new Error('Expected array of DocTypes');
      }
      
      console.log(`   Found ${docTypes.length} DocTypes`);
    });

    await this.runTest('Check DocType Exists', async () => {
      const response = await this.client.callTool('check_doctype_exists', {
        doctype: 'User'
      });
      
      const result = JSON.parse(response.content[0].text);
      if (!result.exists) {
        throw new Error('User DocType should exist');
      }
    });
  }

  async testSchemaOperations() {
    await this.runTest('Get DocType Schema', async () => {
      const response = await this.client.callTool('get_doctype_schema', {
        doctype: 'User'
      });
      
      if (!response.content || !response.content[0].text) {
        throw new Error('No schema response');
      }
      
      const schema = JSON.parse(response.content[0].text);
      if (!schema.fields || !Array.isArray(schema.fields)) {
        throw new Error('Schema should have fields array');
      }
      
      console.log(`   Schema has ${schema.fields.length} fields`);
    });
  }

  async testDocumentOperations() {
    // Test with a safe read-only operation first
    await this.runTest('List Documents', async () => {
      const response = await this.client.callTool('list_documents', {
        doctype: 'User',
        limit: 5
      });
      
      if (!response.content || !response.content[0].text) {
        throw new Error('No documents response');
      }
      
      const docs = JSON.parse(response.content[0].text);
      if (!Array.isArray(docs)) {
        throw new Error('Expected array of documents');
      }
      
      console.log(`   Found ${docs.length} User documents`);
    });
  }

  async testHelperOperations() {
    await this.runTest('Get Module List', async () => {
      const response = await this.client.callTool('get_module_list', {});
      
      const modules = JSON.parse(response.content[0].text);
      if (!Array.isArray(modules) || modules.length === 0) {
        throw new Error('Expected array of modules');
      }
      
      console.log(`   Found ${modules.length} modules`);
    });

    await this.runTest('Get API Instructions', async () => {
      const response = await this.client.callTool('get_api_instructions', {
        category: 'DOCUMENT_OPERATIONS',
        operation: 'GET'
      });
      
      if (!response.content || !response.content[0].text) {
        throw new Error('No instructions response');
      }
      
      console.log(`   Retrieved API instructions (${response.content[0].text.length} chars)`);
    });
  }

  async runAllTests() {
    console.log('🔍 Running Real Frappe Integration Tests');
    console.log(`📡 Frappe URL: ${this.frappeUrl}`);
    console.log(`🔐 Using API key: ${this.frappeApiKey.substring(0, 10)}...`);
    
    let passed = 0;
    let total = 0;

    const tests = [
      () => this.testBasicConnectivity(),
      () => this.testDocTypeOperations(),
      () => this.testSchemaOperations(),
      () => this.testDocumentOperations(),
      () => this.testHelperOperations(),
    ];

    for (const test of tests) {
      const result = await test();
      if (result) passed++;
      total++;
    }

    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! The MCP server works correctly with real Frappe.');
    } else {
      console.log('⚠️  Some tests failed. Check the output above for details.');
      process.exit(1);
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let url = process.env.FRAPPE_URL;
  let apiKey = process.env.FRAPPE_API_KEY;
  let apiSecret = process.env.FRAPPE_API_SECRET;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && i + 1 < args.length) {
      url = args[i + 1];
    } else if (args[i] === '--api-key' && i + 1 < args.length) {
      apiKey = args[i + 1];
    } else if (args[i] === '--api-secret' && i + 1 < args.length) {
      apiSecret = args[i + 1];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Real Frappe Integration Test

Usage:
  FRAPPE_URL=https://epinomy.com FRAPPE_API_KEY=key FRAPPE_API_SECRET=secret node test-with-real-frappe.js
  
Or:
  node test-with-real-frappe.js --url https://epinomy.com --api-key key --api-secret secret

Options:
  --url         Frappe instance URL
  --api-key     Frappe API key
  --api-secret  Frappe API secret
  --help        Show this help message
      `);
      process.exit(0);
    }
  }

  return { url, apiKey, apiSecret };
}

// Main execution
async function main() {
  const { url, apiKey, apiSecret } = parseArgs();

  if (!url || !apiKey || !apiSecret) {
    console.error('❌ Error: Frappe URL, API key, and API secret are required');
    console.error('Set FRAPPE_URL, FRAPPE_API_KEY, and FRAPPE_API_SECRET environment variables');
    console.error('Or use --url, --api-key, and --api-secret arguments');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  const tester = new RealFrappeTest(url, apiKey, apiSecret);
  
  try {
    await tester.setup();
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

main().catch(console.error);