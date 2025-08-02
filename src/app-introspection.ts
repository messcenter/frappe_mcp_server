import { frappe } from './api-client.js';
import { handleApiError } from './errors.js';
import { callMethod } from './document-api.js';

/**
 * Interface for app usage instructions
 */
export interface AppUsageInstructions {
  app_name?: string;
  app_description?: string;
  main_workflows?: Array<{
    name: string;
    description: string;
    steps: string[];
    related_doctypes?: string[];
  }>;
  key_concepts?: Array<{
    name: string;
    description: string;
  }>;
}

/**
 * Interface for DocType usage instructions
 */
export interface DocTypeUsageInstructions {
  doctype: string;
  instructions: {
    description: string;
    usage_guidance: string;
    key_fields?: Array<{
      name: string;
      description: string;
    }>;
    common_workflows?: string[];
  };
}

/**
 * Cache of DocType to app mappings
 */
const doctypeAppCache = new Map<string, string>();

/**
 * Cache of app usage instructions
 */
const appInstructionsCache = new Map<string, AppUsageInstructions>();

/**
 * Cache of DocType usage instructions
 */
const doctypeInstructionsCache = new Map<string, DocTypeUsageInstructions>();

/**
 * Get the app that a DocType belongs to
 * @param doctype The DocType name
 * @returns The app name, or null if not found
 */
export async function getAppForDocType(doctype: string): Promise<string | null> {
  try {
    // Check cache first
    if (doctypeAppCache.has(doctype)) {
      return doctypeAppCache.get(doctype) || null;
    }

    // Query Frappe to get the module for this DocType
    const doctypeDoc = await frappe.db().getDoc('DocType', doctype);
    if (!doctypeDoc || !doctypeDoc.module) {
      return null;
    }

    // Query Frappe to get the app for this module
    const moduleDoc = await frappe.db().getDoc('Module Def', doctypeDoc.module);
    if (!moduleDoc || !moduleDoc.app_name) {
      return null;
    }

    // Cache the result
    const appName = moduleDoc.app_name;
    doctypeAppCache.set(doctype, appName);
    
    return appName;
  } catch (error) {
    console.error(`Error getting app for DocType ${doctype}:`, error);
    return null;
  }
}

/**
 * Check if an app has a usage instructions API
 * @param appName The app name
 * @returns True if the app has a usage instructions API
 */
export async function hasUsageInstructionsAPI(appName: string): Promise<boolean> {
  try {
    // Try to call the get_usage_instructions method
    // We'll use a dummy call with no parameters to check if the method exists
    await callMethod(`${appName}.api_usage.get_usage_instructions`);
    return true;
  } catch (error) {
    // If we get a specific error about the method not existing, return false
    // Otherwise, it might be another error (like missing parameters), which means the method exists
    const errorMessage = (error as Error).message || '';
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      return false;
    }
    
    // If it's some other error, assume the method exists but had an issue
    return true;
  }
}

/**
 * Get usage instructions for an app
 * @param appName The app name
 * @returns The app usage instructions, or null if not available
 */
export async function getAppUsageInstructions(appName: string): Promise<AppUsageInstructions | null> {
  try {
    // Check cache first
    if (appInstructionsCache.has(appName)) {
      return appInstructionsCache.get(appName) || null;
    }

    // Check if the app has a usage instructions API
    const hasAPI = await hasUsageInstructionsAPI(appName);
    if (!hasAPI) {
      return null;
    }

    // Call the app's usage instructions API
    const instructions = await callMethod(`${appName}.api_usage.get_usage_instructions`);
    
    // Cache the result
    appInstructionsCache.set(appName, instructions);
    
    return instructions;
  } catch (error) {
    console.error(`Error getting usage instructions for app ${appName}:`, error);
    return null;
  }
}

/**
 * Get usage instructions for a DocType from its app
 * @param doctype The DocType name
 * @returns The DocType usage instructions, or null if not available
 */
export async function getDocTypeUsageInstructions(doctype: string): Promise<DocTypeUsageInstructions | null> {
  try {
    // Check cache first
    if (doctypeInstructionsCache.has(doctype)) {
      return doctypeInstructionsCache.get(doctype) || null;
    }

    // Get the app for this DocType
    const appName = await getAppForDocType(doctype);
    if (!appName) {
      return null;
    }

    // Check if the app has a usage instructions API
    const hasAPI = await hasUsageInstructionsAPI(appName);
    if (!hasAPI) {
      return null;
    }

    // Call the app's usage instructions API with the DocType
    const instructions = await callMethod(`${appName}.api_usage.get_usage_instructions`, { doctype });
    
    // Cache the result
    doctypeInstructionsCache.set(doctype, instructions);
    
    return instructions;
  } catch (error) {
    console.error(`Error getting usage instructions for DocType ${doctype}:`, error);
    return null;
  }
}

/**
 * Clear all caches
 * This should be called periodically to ensure fresh data
 */
export function clearIntrospectionCaches(): void {
  doctypeAppCache.clear();
  appInstructionsCache.clear();
  doctypeInstructionsCache.clear();
  console.error('Cleared app introspection caches');
}

/**
 * Initialize the app introspection system
 * This should be called during server startup
 */
export async function initializeAppIntrospection(): Promise<void> {
  console.error('Initializing app introspection...');
  
  // Set up a timer to clear caches periodically (every hour)
  setInterval(clearIntrospectionCaches, 60 * 60 * 1000);
  
  console.error('App introspection initialized');
}