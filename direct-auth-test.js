import axios from 'axios';

// Function to make a direct API call with invalid credentials
async function testInvalidAuth() {
  console.log('Testing direct API call with invalid credentials...');
  
  try {
    const response = await axios({
      method: 'get',
      url: 'http://localhost:8000/api/method/frappe.auth.get_logged_user',
      headers: {
        'Authorization': 'token invalid_key:invalid_secret',
        'Accept': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('Error caught:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log('Status:', error.response.status);
      console.log('Status Text:', error.response.statusText);
      console.log('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
      
      // Analyze the error data
      const data = error.response.data;
      if (data) {
        console.log('\n--- FRAPPE ERROR DETAILS ---');
        if (data.exc_type) console.log('Exception type:', data.exc_type);
        if (data.exception) console.log('Exception:', data.exception);
        if (data._server_messages) console.log('Server messages:', data._server_messages);
        if (data.message) console.log('Message:', data.message);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.log('No response received. Request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error setting up request:', error.message);
    }
  }
}

// Run the test
testInvalidAuth().catch(err => {
  console.error('Unexpected error:', err);
});