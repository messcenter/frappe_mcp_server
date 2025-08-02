/**
 * FRAPPE SERVER WRITE OPERATIONS
 *
 * This file contains all the functions that write to the Frappe server.
 * Extracted from frappe-api.ts and document-operations.ts for Frappe support.
 */

import axios, { AxiosError } from "axios";
import { FrappeApp } from "frappe-js-sdk";

// Error class for Frappe API errors
export class FrappeApiError extends Error {
    statusCode?: number;
    endpoint?: string;
    details?: any;

    constructor(message: string, statusCode?: number, endpoint?: string, details?: any) {
        super(message);
        this.name = "FrappeApiError";
        this.statusCode = statusCode;
        this.endpoint = endpoint;
        this.details = details;
    }

    static fromAxiosError(error: AxiosError, operation: string): FrappeApiError {
        const statusCode = error.response?.status;
        const endpoint = error.config?.url || "unknown";
        let message = `Frappe API error during ${operation}: ${error.message}`;
        let details: any = null;

        // Extract more detailed error information from Frappe's response
        if (error.response?.data) {
            const data = error.response.data as any;
            if (data.exception) {
                message = `Frappe exception during ${operation}: ${data.exception}`;
                details = data;
            } else if (data._server_messages) {
                try {
                    // Server messages are often JSON strings inside a string
                    const serverMessages = JSON.parse(data._server_messages);
                    const parsedMessages = Array.isArray(serverMessages)
                        ? serverMessages.map((msg: string) => {
                            try {
                                return JSON.parse(msg);
                            } catch {
                                return msg;
                            }
                        })
                        : [serverMessages];

                    message = `Frappe server message during ${operation}: ${parsedMessages.map((m: any) => m.message || m).join("; ")}`;
                    details = { serverMessages: parsedMessages };
                } catch (e) {
                    message = `Frappe server message during ${operation}: ${data._server_messages}`;
                    details = { serverMessages: data._server_messages };
                }
            } else if (data.message) {
                message = `Frappe API error during ${operation}: ${data.message}`;
                details = data;
            }
        }

        return new FrappeApiError(message, statusCode, endpoint, details);
    }
}

// Initialize Frappe JS SDK
const frappe = new FrappeApp(process.env.FRAPPE_URL || "http://localhost:8000", {
    useToken: true,
    token: () => `${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`,
    type: "token", // For API key/secret pairs
});

// ==================== DOCUMENT CREATION ====================

/**
 * Create a document with verification
 */
export async function createDocument(
    doctype: string,
    values: Record<string, any>
): Promise<any> {
    try {
        if (!doctype) throw new Error("DocType is required");
        if (!values || Object.keys(values).length === 0) {
            throw new Error("Document values are required");
        }

        console.error(`Creating document of type ${doctype} with values:`, JSON.stringify(values, null, 2));

        const response = await frappe.db().createDoc(doctype, values);

        console.error(`Create document response:`, JSON.stringify(response, null, 2));

        if (!response) {
            throw new Error(`Invalid response format for creating ${doctype}`);
        }

        // IMPROVED VERIFICATION: Make this a required step, not just a try-catch
        const verificationResult = await verifyDocumentCreation(doctype, values, response);
        if (!verificationResult.success) {
            console.error(`Document creation verification failed: ${verificationResult.message}`);
            // Return the response but include verification info
            return { ...response, _verification: verificationResult };
        }

        return response;
    } catch (error) {
        console.error(`Error in createDocument:`, error);
        return handleApiError(error, `create_document(${doctype})`);
    }
}


/**
 * Verify that a document was successfully created
 */
async function verifyDocumentCreation(
    doctype: string,
    values: Record<string, any>,
    creationResponse: any
): Promise<{ success: boolean; message: string }> {
    try {
        // First check if we have a name in the response
        if (!creationResponse.name) {
            return { success: false, message: "Response does not contain a document name" };
        }

        // Try to fetch the document directly by name
        try {
            const document = await frappe.db().getDoc(doctype, creationResponse.name);
            if (document && document.name === creationResponse.name) {
                return { success: true, message: "Document verified by direct fetch" };
            }
        } catch (error) {
            console.error(`Error fetching document by name during verification:`, error);
            // Continue with alternative verification methods
        }

        // Try to find the document by filtering
        const filters: Record<string, any> = {};

        // Use the most unique fields for filtering
        if (values.name) {
            filters['name'] = ['=', values.name];
        } else if (values.title) {
            filters['title'] = ['=', values.title];
        } else if (values.description) {
            // Use a substring of the description to avoid issues with long text
            filters['description'] = ['like', `%${values.description.substring(0, 20)}%`];
        }

        if (Object.keys(filters).length > 0) {
            const documents = await frappe.db().getDocList(doctype, {
                filters: filters as any[],
                limit: 5
            });

            if (documents && documents.length > 0) {
                // Check if any of the returned documents match our expected name
                const matchingDoc = documents.find(doc => doc.name === creationResponse.name);
                if (matchingDoc) {
                    return { success: true, message: "Document verified by filter search" };
                }

                // If we found documents but none match our expected name, that's suspicious
                return {
                    success: false,
                    message: `Found ${documents.length} documents matching filters, but none match the expected name ${creationResponse.name}`
                };
            }

            return {
                success: false,
                message: "No documents found matching the creation filters"
            };
        }

        // If we couldn't verify with filters, return a warning
        return {
            success: false,
            message: "Could not verify document creation - no suitable filters available"
        };
    } catch (verifyError) {
        return {
            success: false,
            message: `Error during verification: ${(verifyError as Error).message}`
        };
    }
}

/**
 * Create a document with retry logic
 */
async function createDocumentWithRetry(
    doctype: string,
    values: Record<string, any>,
    maxRetries = 3
): Promise<any> {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.error(`Attempt ${attempt} to create document of type ${doctype}`);

            const result = await frappe.db().createDoc(doctype, values);

            // Verify document creation
            const verificationResult = await verifyDocumentCreation(doctype, values, result);
            if (verificationResult.success) {
                console.error(`Document creation verified on attempt ${attempt}`);
                return { ...result, _verification: verificationResult };
            }

            // If verification failed, throw an error to trigger retry
            lastError = new Error(`Verification failed: ${verificationResult.message}`);
            console.error(`Verification failed on attempt ${attempt}: ${verificationResult.message}`);

            // Wait before retrying (exponential backoff)
            const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, etc.
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
            lastError = error;
            console.error(`Error on attempt ${attempt}:`, error);

            // Wait before retrying
            const delay = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // If we've exhausted all retries, throw the last error
    throw lastError || new Error(`Failed to create document after ${maxRetries} attempts`);
}

/**
 * Create a document with transaction-like pattern
 */
async function createDocumentTransactional(
    doctype: string,
    values: Record<string, any>
): Promise<any> {
    // 1. Create a temporary log entry to track this operation
    const operationId = `create_${doctype}_${Date.now()}`;
    try {
        // Log the operation start
        await logOperation(operationId, 'start', { doctype, values });

        // 2. Attempt to create the document
        const result = await createDocumentWithRetry(doctype, values);

        // 3. Verify the document was created
        const verificationResult = await verifyDocumentCreation(doctype, values, result);

        // 4. Log the operation result
        await logOperation(operationId, verificationResult.success ? 'success' : 'failure', {
            result,
            verification: verificationResult
        });

        // 5. Return the result with verification info
        return {
            ...result,
            _verification: verificationResult
        };
    } catch (error) {
        // Log the operation error
        await logOperation(operationId, 'error', { error: (error as Error).message });
        throw error;
    }
}

// ==================== DOCUMENT UPDATES ====================

/**
 * Update an existing document
 */
export async function updateDocument(
    doctype: string,
    name: string,
    values: Record<string, any>
): Promise<any> {
    try {
        if (!doctype) throw new Error("DocType is required");
        if (!name) throw new Error("Document name is required");
        if (!values || Object.keys(values).length === 0) {
            throw new Error("Update values are required");
        }

        const response = await frappe.db().updateDoc(doctype, name, values);

        if (!response) {
            throw new Error(`Invalid response format for updating ${doctype}/${name}`);
        }

        return response;
    } catch (error) {
        return handleApiError(error, `update_document(${doctype}, ${name})`);
    }
}


// ==================== DOCUMENT DELETION ====================

/**
 * Delete a document
 */
export async function deleteDocument(
    doctype: string,
    name: string
): Promise<any> {
    try {
        if (!doctype) throw new Error("DocType is required");
        if (!name) throw new Error("Document name is required");

        const response = await frappe.db().deleteDoc(doctype, name);

        if (!response) {
            return response;
        }
        return response;

    } catch (error) {
        return handleApiError(error, `delete_document(${doctype}, ${name})`);
    }
}


// ==================== METHOD CALLS ====================

/**
 * Execute a Frappe method call
 * @param method The method name to call
 * @param params The parameters to pass to the method
 * @returns The method response
 */
export async function callMethod(
    method: string,
    params?: Record<string, any>
): Promise<any> {
    try {
        if (!method) throw new Error("Method name is required");

        const response = await frappe.call().post(method, params);

        if (!response) {
            throw new Error(`Invalid response format for method ${method}`);
        }

        return response;
    } catch (error) {
        return handleApiError(error, `call_method(${method})`);
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Log operation for transaction-like pattern
 */
async function logOperation(
    operationId: string,
    status: 'start' | 'success' | 'failure' | 'error',
    data: any
): Promise<void> {
    // This could write to a local log file, a database, or even a separate API
    console.error(`[Operation ${operationId}] ${status}:`, JSON.stringify(data, null, 2));

    // In a production system, you might want to persist this information
    // to help with debugging and recovery
}

/**
 * Helper function to handle API errors
 */
function handleApiError(error: any, operation: string): never {
    if (axios.isAxiosError(error)) {
        throw FrappeApiError.fromAxiosError(error, operation);
    } else {
        throw new FrappeApiError(`Error during ${operation}: ${(error as Error).message}`);
    }
}
