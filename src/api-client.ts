import { FrappeApp } from "frappe-js-sdk";

// Get environment variables with standardized access pattern
const FRAPPE_URL = process.env.FRAPPE_URL || "http://localhost:8000";
const FRAPPE_API_KEY = process.env.FRAPPE_API_KEY;
const FRAPPE_API_SECRET = process.env.FRAPPE_API_SECRET;
const FRAPPE_TEAM_NAME = process.env.FRAPPE_TEAM_NAME || "";


// Create token function with enhanced error handling
const getToken = () => {
  if (!FRAPPE_API_KEY || !FRAPPE_API_SECRET) {
    console.error("[AUTH] ERROR: Missing API credentials when attempting to create authentication token");
    throw new Error("Authentication failed: Missing API key or secret. Both are required.");
  }
  
  const token = `${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`;
  
  // Validate token format
  if (!token.includes(':') || token === ':' || token.startsWith(':') || token.endsWith(':')) {
    console.error("[AUTH] ERROR: Malformed authentication token");
    throw new Error("Authentication failed: Malformed token. Check API key and secret format.");
  }
  
  return token;
};

// Initialize Frappe JS SDK with enhanced error handling - use lazy initialization
let frappeInstance: FrappeApp | null = null;

export const frappe = {
  get instance(): FrappeApp {
    if (!frappeInstance) {
      // Enhanced logging for debugging
      console.error(`[AUTH] Initializing Frappe JS SDK with URL: ${FRAPPE_URL}`);
      console.error(`[AUTH] API Key available: ${!!FRAPPE_API_KEY}`);
      console.error(`[AUTH] API Secret available: ${!!FRAPPE_API_SECRET}`);

      // Show first few characters of credentials for debugging (never show full credentials)
      if (FRAPPE_API_KEY) {
        console.error(`[AUTH] API Key prefix: ${FRAPPE_API_KEY.substring(0, 4)}...`);
        console.error(`[AUTH] API Key length: ${FRAPPE_API_KEY.length} characters`);
      }
      if (FRAPPE_API_SECRET) {
        console.error(`[AUTH] API Secret length: ${FRAPPE_API_SECRET.length} characters`);
      }

      // Log authentication method and status
      if (!FRAPPE_API_KEY || !FRAPPE_API_SECRET) {
        console.error("[AUTH] WARNING: API key/secret authentication is required. Missing credentials will cause operations to fail.");
        console.error("[AUTH] Please set both FRAPPE_API_KEY and FRAPPE_API_SECRET environment variables.");
      } else {
        console.error("[AUTH] Using API key/secret authentication (token-based)");
        
        // Test token formation
        const testToken = `${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`;
        console.error(`[AUTH] Test token formed successfully, length: ${testToken.length} characters`);
        console.error(`[AUTH] Token format check: ${testToken.includes(':') ? 'Valid (contains colon separator)' : 'Invalid (missing colon separator)'}`);
      }

      frappeInstance = new FrappeApp(FRAPPE_URL, {
        useToken: true,
        token: getToken,
        type: "token", // For API key/secret pairs
      });
      
      // Add request interceptor with enhanced authentication debugging
      frappeInstance.axios.interceptors.request.use(config => {
        config.headers = config.headers || {};
        console.error(`Request method: ${config.method}`);
        config.headers['X-Press-Team'] = FRAPPE_TEAM_NAME;
        
        // Log basic request info
        console.error(`[REQUEST] Making request to: ${config.url}`);
        console.error(`[REQUEST] Method: ${config.method}`);
        
        // Enhanced authentication header debugging
        const authHeader = config.headers['Authorization'] as string;
        
        // Detailed auth header analysis
        if (!authHeader) {
          console.error('[AUTH] ERROR: Authorization header is missing completely');
        } else if (authHeader.includes('undefined')) {
          console.error('[AUTH] ERROR: Authorization header contains "undefined"');
        } else if (authHeader.includes('null')) {
          console.error('[AUTH] ERROR: Authorization header contains "null"');
        } else if (authHeader === ':') {
          console.error('[AUTH] ERROR: Authorization header is just a colon - both API key and secret are empty strings');
        } else if (!authHeader.includes(':')) {
          console.error('[AUTH] ERROR: Authorization header is missing the colon separator');
        } else if (authHeader.startsWith(':')) {
          console.error('[AUTH] ERROR: Authorization header is missing the API key (starts with colon)');
        } else if (authHeader.endsWith(':')) {
          console.error('[AUTH] ERROR: Authorization header is missing the API secret (ends with colon)');
        } else {
          // Safe logging of auth header (partial)
          const parts = authHeader.split(':');
          console.error(`[AUTH] Authorization header format: ${parts[0].substring(0, 4)}...:${parts[1] ? '***' : 'missing'}`);
          console.error(`[AUTH] Authorization header length: ${authHeader.length} characters`);
        }
        
        // Log other headers without the auth header
        const headersForLogging = {...config.headers};
        delete headersForLogging['Authorization']; // Remove auth header for safe logging
        console.error(`[REQUEST] Headers:`, JSON.stringify(headersForLogging, null, 2));
        
        if (config.data) {
          console.error(`[REQUEST] Data:`, JSON.stringify(config.data, null, 2));
        }
        
        return config;
      });

      // Add response interceptor with enhanced error handling
      frappeInstance.axios.interceptors.response.use(
        response => {
          console.error(`[RESPONSE] Status: ${response.status}`);
          console.error(`[RESPONSE] Headers:`, JSON.stringify(response.headers, null, 2));
          console.error(`[RESPONSE] Data:`, JSON.stringify(response.data, null, 2));
          return response;
        },
        error => {
          console.error(`[ERROR] Response error occurred:`, error.message);
          
          // Enhanced error logging
          if (error.response) {
            console.error(`[ERROR] Status: ${error.response.status}`);
            console.error(`[ERROR] Status text: ${error.response.statusText}`);
            console.error(`[ERROR] Data:`, JSON.stringify(error.response.data, null, 2));
            
            // Special handling for authentication errors
            if (error.response.status === 401 || error.response.status === 403) {
              console.error(`[AUTH ERROR] Authentication failed with status ${error.response.status}`);
              
              // Check for specific Frappe error patterns
              const data = error.response.data;
              if (data) {
                if (data.exc_type) console.error(`[AUTH ERROR] Exception type: ${data.exc_type}`);
                if (data.exception) console.error(`[AUTH ERROR] Exception: ${data.exception}`);
                if (data._server_messages) console.error(`[AUTH ERROR] Server messages: ${data._server_messages}`);
                if (data.message) console.error(`[AUTH ERROR] Message: ${data.message}`);
              }
              
              // Add authentication error info to the error object for better error handling
              error.authError = true;
              error.authErrorDetails = {
                status: error.response.status,
                data: error.response.data,
                apiKeyAvailable: !!FRAPPE_API_KEY,
                apiSecretAvailable: !!FRAPPE_API_SECRET
              };
            }
          } else if (error.request) {
            console.error(`[ERROR] No response received. Request:`, error.request);
          } else {
            console.error(`[ERROR] Error setting up request:`, error.message);
          }
          
          // Log config information
          if (error.config) {
            console.error(`[ERROR] Request URL: ${error.config.method?.toUpperCase()} ${error.config.url}`);
            console.error(`[ERROR] Base URL: ${error.config.baseURL}`);
            
            // Log headers without auth header
            const headersForLogging = {...error.config.headers};
            delete headersForLogging['Authorization']; // Remove auth header for safe logging
            console.error(`[ERROR] Request headers:`, JSON.stringify(headersForLogging, null, 2));
          }
          
          return Promise.reject(error);
        }
      );
    }
    return frappeInstance;
  },
  
  // Proxy essential FrappeApp methods and properties
  get axios() { return this.instance.axios; },
  get db() { return this.instance.db; },
  get auth() { return this.instance.auth; },
  get call() { return this.instance.call; },
  get file() { return this.instance.file; }
};

