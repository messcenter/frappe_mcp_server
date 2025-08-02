import { frappe } from './api-client.js';

// Authentication state tracking
let isAuthenticated = false;
let authenticationInProgress = false;
let lastAuthAttempt = 0;
const AUTH_TIMEOUT = 1000 * 60 * 30; // 30 minutes

/**
 * Validates that the required API credentials are available
 * @returns Object indicating if credentials are valid with detailed message
 */
export function validateApiCredentials(): {
  valid: boolean;
  message: string;
} {
  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;
  
  if (!apiKey && !apiSecret) {
    return {
      valid: false,
      message: "Authentication failed: Both API key and API secret are missing. API key/secret is the only supported authentication method."
    };
  }
  
  if (!apiKey) {
    return {
      valid: false,
      message: "Authentication failed: API key is missing. API key/secret is the only supported authentication method."
    };
  }
  
  if (!apiSecret) {
    return {
      valid: false,
      message: "Authentication failed: API secret is missing. API key/secret is the only supported authentication method."
    };
  }
  
  return {
    valid: true,
    message: "API credentials validation successful."
  };
}

/**
 * Check the health of the Frappe API connection
 * @returns Health status information
 */
export async function checkFrappeApiHealth(): Promise<{
  healthy: boolean;
  tokenAuth: boolean;
  message: string;
}> {
  const result = {
    healthy: false,
    tokenAuth: false,
    message: ""
  };

  // First validate credentials
  const credentialsCheck = validateApiCredentials();
  if (!credentialsCheck.valid) {
    result.message = credentialsCheck.message;
    console.error(`API Health Check: ${result.message}`);
    return result;
  }

  try {
    // Try token authentication
    try {
      console.error("Attempting token authentication health check...");
      const tokenResponse = await frappe.db().getDocList("DocType", { limit: 1 });
      result.tokenAuth = true;
      console.error("Token authentication health check successful");
    } catch (tokenError) {
      console.error("Token authentication health check failed:", tokenError);
      result.tokenAuth = false;
    }

    // Set overall health status
    result.healthy = result.tokenAuth;
    result.message = result.healthy
      ? `API connection healthy. Token auth: ${result.tokenAuth}`
      : "API connection unhealthy. Token authentication failed. Please ensure your API key and secret are correct.";

    return result;
  } catch (error) {
    result.message = `Health check failed: ${(error as Error).message}`;
    console.error(`API Health Check Error: ${result.message}`);
    return result;
  }
}