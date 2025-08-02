#!/usr/bin/env node

/**
 * HTTP Transport Test for Frappe MCP Server
 * Tests the server using HTTP requests instead of stdio
 */

import axios from 'axios';

class HttpMcpTester {
  constructor(baseUrl = 'http://localhost:51966') { // 0xCAFE
    this.baseUrl = baseUrl;
    this.mcpEndpoint = `${baseUrl}/mcp`;
    this.requestId = 1;
  }

  async sendMcpRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    try {
      const response = await axios.post(this.mcpEndpoint, request, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.data?.error?.message || 'Unknown error'}`);
      }
      throw error;
    }
  }

  async testServerInfo() {
    console.log('📡 Testing server info endpoint...');
    try {
      const response = await axios.get(`${this.baseUrl}/info`);
      console.log('✅ Server info:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Server info failed:', error.message);
      return false;
    }
  }

  async testHealth() {
    console.log('❤️  Testing health endpoint...');
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      console.log('✅ Health check:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return false;
    }
  }

  async testPing() {
    console.log('🏓 Testing ping tool...');
    try {
      const response = await axios.post(`${this.baseUrl}/call/ping`, {});
      
      if (response.data?.result?.content?.[0]?.text === 'pong') {
        console.log('✅ Ping successful');
        return true;
      } else {
        console.error('❌ Unexpected ping response:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Ping failed:', error.message);
      return false;
    }
  }

  async testListTools() {
    console.log('🔧 Testing list tools...');
    try {
      const response = await axios.get(`${this.baseUrl}/tools`);
      
      if (response.data?.tools) {
        console.log(`✅ Found ${response.data.tools.length} tools:`, 
          response.data.tools.map(t => t.name).slice(0, 5));
        return true;
      } else {
        console.error('❌ No tools in response:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ List tools failed:', error.message);
      return false;
    }
  }

  async testFindDocTypes() {
    console.log('📋 Testing find doctypes...');
    try {
      const response = await axios.post(`${this.baseUrl}/call/find_doctypes`, { limit: 3 });
      
      if (response.data?.result?.content?.[0]?.text) {
        const docTypes = JSON.parse(response.data.result.content[0].text);
        console.log(`✅ Found ${docTypes.length} DocTypes:`, docTypes.map(dt => dt.name));
        return true;
      } else {
        console.error('❌ No doctypes in response:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Find doctypes failed:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting HTTP MCP Server Tests');
    console.log(`📡 Testing server at: ${this.baseUrl}`);
    
    const tests = [
      () => this.testHealth(),
      () => this.testServerInfo(),
      () => this.testPing(),
      () => this.testListTools(),
      () => this.testFindDocTypes(),
    ];

    let passed = 0;
    let total = tests.length;

    for (let i = 0; i < tests.length; i++) {
      console.log(`\n--- Test ${i + 1}/${total} ---`);
      const result = await tests[i]();
      if (result) passed++;
    }

    console.log(`\n📊 Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All HTTP tests passed!');
    } else {
      console.log('⚠️  Some tests failed. Check output above.');
      process.exit(1);
    }
  }
}

// Check if server URL provided
const serverUrl = process.argv[2] || 'http://localhost:51966'; // Port 51966 = 0xCAFE

async function main() {
  const tester = new HttpMcpTester(serverUrl);
  
  console.log('⏳ Waiting for server to be ready...');
  
  // Wait for server to start
  let retries = 30;
  while (retries > 0) {
    try {
      await axios.get(`${serverUrl}/health`, { timeout: 2000 });
      console.log('✅ Server is responding');
      break;
    } catch (error) {
      retries--;
      console.log(`⏳ Waiting for server... (${retries} retries left)`);
      if (retries === 0) {
        console.error('❌ Server not responding. Make sure to start it first:');
        console.error('   FRAPPE_URL=https://epinomy.com FRAPPE_API_KEY=ff09790d111aeab FRAPPE_API_SECRET=d3bc10957fd898f npm run start-http');
        console.error('Error:', error.message);
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await tester.runAllTests();
}

main().catch(console.error);