#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function quickTest() {
  console.log('🚀 Quick test with epinomy credentials...');
  
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
    name: 'quick-test',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected!');
    
    // Test ping
    console.log('Testing ping...');
    const pingResponse = await client.callTool('ping', {});
    console.log('Ping response:', pingResponse.content[0].text);
    
    // Test find doctypes
    console.log('Testing find_doctypes...');
    const docTypesResponse = await client.callTool('find_doctypes', { limit: 3 });
    const docTypes = JSON.parse(docTypesResponse.content[0].text);
    console.log(`Found ${docTypes.length} DocTypes:`, docTypes.map(dt => dt.name));
    
    console.log('🎉 Quick test successful!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.close();
  }
}

quickTest();