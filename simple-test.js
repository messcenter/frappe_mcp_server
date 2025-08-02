#!/usr/bin/env node

// Simple test to check if HTTP server is running
import axios from 'axios';

async function simpleTest() {
  try {
    console.log('🧪 Testing HTTP server at http://localhost:51966 (0xCAFE)');
    
    // Test health endpoint
    console.log('Testing /health...');
    const healthResponse = await axios.get('http://localhost:51966/health', { timeout: 5000 });
    console.log('✅ Health:', healthResponse.data);
    
    // Test info endpoint
    console.log('Testing /info...');
    const infoResponse = await axios.get('http://localhost:51966/info', { timeout: 5000 });
    console.log('✅ Info:', infoResponse.data);
    
    // Test ping tool
    console.log('Testing ping tool...');
    const pingResponse = await axios.post('http://localhost:51966/call/ping', {}, { timeout: 5000 });
    console.log('✅ Ping:', pingResponse.data);
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

simpleTest();