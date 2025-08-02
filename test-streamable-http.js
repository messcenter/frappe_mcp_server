#!/usr/bin/env node

/**
 * Test script for Streamable HTTP server
 * Tests both regular JSON responses and SSE streaming
 */

import axios from 'axios';
import { EventSource } from 'eventsource';

const SERVER_URL = 'http://localhost:51953'; // 0xCAF1

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testJsonResponse() {
  log('\n=== Testing JSON Response Mode ===', colors.bright + colors.blue);
  
  try {
    // Test initialize
    log('\nTesting initialize...', colors.cyan);
    const initResponse = await axios.post(SERVER_URL, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {}
    });
    
    log('✓ Initialize successful', colors.green);
    log(`Session ID: ${initResponse.data.result.sessionId}`, colors.yellow);
    
    const sessionId = initResponse.data.result.sessionId;
    
    // Test tools/list
    log('\nTesting tools/list...', colors.cyan);
    const toolsResponse = await axios.post(SERVER_URL, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    }, {
      headers: { 'x-session-id': sessionId }
    });
    
    log(`✓ Found ${toolsResponse.data.result.tools.length} tools`, colors.green);
    
    // Test tools/call
    log('\nTesting tools/call (ping)...', colors.cyan);
    const pingResponse = await axios.post(SERVER_URL, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "ping",
        arguments: {}
      }
    }, {
      headers: { 'x-session-id': sessionId }
    });
    
    log(`✓ Ping response: ${pingResponse.data.result.content[0].text}`, colors.green);
    
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
    if (error.response) {
      log(`Response: ${JSON.stringify(error.response.data, null, 2)}`, colors.red);
    }
  }
}

async function testSSEStreaming() {
  log('\n=== Testing SSE Streaming Mode ===', colors.bright + colors.blue);
  
  return new Promise(async (resolve) => {
    try {
      // First get a session via regular JSON
      log('\nGetting session...', colors.cyan);
      const initResponse = await axios.post(SERVER_URL, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {}
      });
      
      const sessionId = initResponse.data.result.sessionId;
      log(`Session ID: ${sessionId}`, colors.yellow);
      
      // Now test SSE streaming
      log('\nTesting SSE stream for tools/call...', colors.cyan);
      
      // Use fetch for SSE request
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "list_documents",
            arguments: {
              doctype: "DocType",
              limit: 5
            }
          }
        })
      });
      
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        log('✓ Received SSE stream', colors.green);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              log(`Received SSE message: ${JSON.stringify(data).substring(0, 100)}...`, colors.cyan);
            } else if (line.startsWith(':heartbeat')) {
              log('♥ Heartbeat received', colors.yellow);
            }
          }
        }
      } else {
        log('✗ Did not receive SSE stream', colors.red);
      }
      
      resolve();
    } catch (error) {
      log(`✗ Error: ${error.message}`, colors.red);
      resolve();
    }
  });
}

async function testHealthAndInfo() {
  log('\n=== Testing Health and Info Endpoints ===', colors.bright + colors.blue);
  
  try {
    // Test health
    log('\nTesting /health...', colors.cyan);
    const healthResponse = await axios.get(`${SERVER_URL}/health`);
    log(`✓ Server health: ${healthResponse.data.status}`, colors.green);
    log(`  Transport: ${healthResponse.data.transport}`, colors.yellow);
    log(`  Active sessions: ${healthResponse.data.sessions}`, colors.yellow);
    
    // Test info
    log('\nTesting /info...', colors.cyan);
    const infoResponse = await axios.get(`${SERVER_URL}/info`);
    log(`✓ Server info:`, colors.green);
    log(`  Name: ${infoResponse.data.name}`, colors.yellow);
    log(`  Version: ${infoResponse.data.version}`, colors.yellow);
    log(`  Protocol: ${infoResponse.data.protocol}`, colors.yellow);
    log(`  Streaming: ${infoResponse.data.capabilities.streaming}`, colors.yellow);
    log(`  Stateful: ${infoResponse.data.capabilities.stateful}`, colors.yellow);
    
  } catch (error) {
    log(`✗ Error: ${error.message}`, colors.red);
  }
}

async function runTests() {
  log('\n🚀 Frappe MCP Streamable HTTP Server Test Suite', colors.bright + colors.cyan);
  log('=' .repeat(50), colors.cyan);
  
  // Check if server is running
  try {
    await axios.get(`${SERVER_URL}/health`);
  } catch (error) {
    log('\n✗ Server is not running!', colors.red);
    log('Please start the server with: npm run start-streamable', colors.yellow);
    process.exit(1);
  }
  
  // Run tests
  await testHealthAndInfo();
  await testJsonResponse();
  await testSSEStreaming();
  
  log('\n✅ All tests completed!', colors.bright + colors.green);
}

// Run tests
runTests().catch(error => {
  log(`\n✗ Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});

// Note: If EventSource is not available, install it with: npm install eventsource