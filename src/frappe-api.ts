// Re-export everything from the new modular files
export { FrappeApiError, handleApiError } from './errors.js';
export { frappe } from './api-client.js';
export { checkFrappeApiHealth } from './auth.js';
export {
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
  callMethod
} from './document-api.js';
export {
  getDocTypeSchema,
  getFieldOptions,
  getAllDocTypes,
  getAllModules
} from './schema-api.js';