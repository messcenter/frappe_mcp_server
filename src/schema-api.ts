import { frappe } from './api-client.js';
import { handleApiError } from './errors.js';
import { getDocument } from './document-api.js';

// Schema operations
/**
 * Get the schema for a DocType
 * @param doctype The DocType name
 * @returns The DocType schema
 */
export async function getDocTypeSchema(doctype: string): Promise<any> {
  try {
    if (!doctype) throw new Error("DocType name is required");

    // Primary approach: Use the standard API endpoint
    console.error(`Using standard API endpoint for ${doctype}`);
    let response;
    try {
      response = await frappe.call().get('frappe.get_meta', { doctype: doctype });
      console.error(`Got response from standard API endpoint for ${doctype}`);
      console.error(`Raw response data:`, JSON.stringify(response?.data, null, 2));
    } catch (error) {
      console.error(`Error using standard API endpoint for ${doctype}:`, error);
      // Fallback to document API
    }

    // Directly use response data from standard API endpoint
    const docTypeData = response;
    console.error(`Using /api/v2/doctype/{doctype}/meta format`);

    if (docTypeData) {
      // If we got schema data from standard API, process and return it
      const doctypeInfo = docTypeData.doctype || {};
      return {
        name: doctype,
        label: doctypeInfo.name || doctype,
        description: doctypeInfo.description,
        module: doctypeInfo.module,
        issingle: doctypeInfo.issingle === 1,
        istable: doctypeInfo.istable === 1,
        custom: doctypeInfo.custom === 1,
        fields: (docTypeData.fields || []).map((field: any) => ({
          fieldname: field.fieldname,
          label: field.label,
          fieldtype: field.fieldtype,
          required: field.reqd === 1,
          description: field.description,
          default: field.default,
          options: field.options,
          // Include validation information
          min_length: field.min_length,
          max_length: field.max_length,
          min_value: field.min_value,
          max_value: field.max_value,
          // Include linked DocType information if applicable
          linked_doctype: field.fieldtype === "Link" ? field.options : null,
          // Include child table information if applicable
          child_doctype: field.fieldtype === "Table" ? field.options : null,
          // Include additional field metadata
          in_list_view: field.in_list_view === 1,
          in_standard_filter: field.in_standard_filter === 1,
          in_global_search: field.in_global_search === 1,
          bold: field.bold === 1,
          hidden: field.hidden === 1,
          read_only: field.read_only === 1,
          allow_on_submit: field.allow_on_submit === 1,
          set_only_once: field.set_only_once === 1,
          allow_bulk_edit: field.allow_bulk_edit === 1,
          translatable: field.translatable === 1,
        })),
        // Include permissions information
        permissions: docTypeData.permissions || [],
        // Include naming information
        autoname: doctypeInfo.autoname,
        name_case: doctypeInfo.name_case,
        // Include workflow information if available
        workflow: docTypeData.workflow || null,
        // Include additional metadata
        is_submittable: doctypeInfo.is_submittable === 1,
        quick_entry: doctypeInfo.quick_entry === 1,
        track_changes: doctypeInfo.track_changes === 1,
        track_views: doctypeInfo.track_views === 1,
        has_web_view: doctypeInfo.has_web_view === 1,
        allow_rename: doctypeInfo.allow_rename === 1,
        allow_copy: doctypeInfo.allow_copy === 1,
        allow_import: doctypeInfo.allow_import === 1,
        allow_events_in_timeline: doctypeInfo.allow_events_in_timeline === 1,
        allow_auto_repeat: doctypeInfo.allow_auto_repeat === 1,
        document_type: doctypeInfo.document_type,
        icon: doctypeInfo.icon,
        max_attachments: doctypeInfo.max_attachments,
      };
    }

    // Fallback to Document API if standard API failed or didn't return schema data
    console.error(`Falling back to document API for ${doctype}`);
    try {
      console.error(`Using document API to get schema for ${doctype}`);

      // 1. Get the DocType document
      console.error(`Fetching DocType document for ${doctype}`);
      const doctypeDoc = await getDocument("DocType", doctype);
      console.error(`DocType document response:`, JSON.stringify(doctypeDoc).substring(0, 200) + "...");
      console.error(`Full DocType document response:`, doctypeDoc);

      if (!doctypeDoc) {
        throw new Error(`DocType ${doctype} not found`);
      }

      console.error(`DocTypeDoc.fields before schema construction:`, doctypeDoc.fields);
      console.error(`DocTypeDoc.permissions before schema construction:`, doctypeDoc.permissions);

      return {
        name: doctype,
        label: doctypeDoc.name || doctype,
        description: doctypeDoc.description,
        module: doctypeDoc.module,
        issingle: doctypeDoc.issingle === 1,
        istable: doctypeDoc.istable === 1,
        custom: doctypeDoc.custom === 1,
        fields: doctypeDoc.fields || [], // Use fields from doctypeDoc if available, otherwise default to empty array
        permissions: doctypeDoc.permissions || [], // Use permissions from doctypeDoc if available, otherwise default to empty array
        autoname: doctypeDoc.autoname,
        name_case: doctypeDoc.name_case,
        workflow: null,
        is_submittable: doctypeDoc.is_submittable === 1,
        quick_entry: doctypeDoc.quick_entry === 1,
        track_changes: doctypeDoc.track_changes === 1,
        track_views: doctypeDoc.track_views === 1,
        has_web_view: doctypeDoc.has_web_view === 1,
        allow_rename: doctypeDoc.allow_rename === 1,
        allow_copy: doctypeDoc.allow_copy === 1,
        allow_import: doctypeDoc.allow_import === 1,
        allow_events_in_timeline: doctypeDoc.allow_events_in_timeline === 1,
        allow_auto_repeat: doctypeDoc.allow_auto_repeat === 1,
        document_type: doctypeDoc.document_type,
        icon: doctypeDoc.icon,
        max_attachments: doctypeDoc.max_attachments,
      };
    } catch (error) {
      console.error(`Error using document API for ${doctype}:`, error);
      // If document API also fails, then we cannot retrieve the schema
    }

    throw new Error(`Could not retrieve schema for DocType ${doctype} using any available method`);
  } catch (error) {
    return handleApiError(error, `get_doctype_schema(${doctype})`);
  }
}

export async function getFieldOptions(
  doctype: string,
  fieldname: string,
  filters?: Record<string, any>
): Promise<Array<{ value: string; label: string }>> {
  try {
    if (!doctype) throw new Error("DocType name is required");
    if (!fieldname) throw new Error("Field name is required");

    // First get the field metadata to determine the type and linked DocType
    const schema = await getDocTypeSchema(doctype);

    if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
      throw new Error(`Invalid schema returned for DocType ${doctype}`);
    }

    const field = schema.fields.find((f: any) => f.fieldname === fieldname);

    if (!field) {
      throw new Error(`Field ${fieldname} not found in DocType ${doctype}`);
    }

    if (field.fieldtype === "Link") {
      // For Link fields, get the list of documents from the linked DocType
      const linkedDocType = field.options;
      if (!linkedDocType) {
        throw new Error(`Link field ${fieldname} has no options (linked DocType) specified`);
      }

      console.error(`Getting options for Link field ${fieldname} from DocType ${linkedDocType}`);

      try {
        // Try to get the title field for the linked DocType
        const linkedSchema = await getDocTypeSchema(linkedDocType);
        const titleField = linkedSchema.fields.find((f: any) => f.fieldname === "title" || f.bold === 1);
        const displayFields = titleField ? ["name", titleField.fieldname] : ["name"];

        const response = await frappe.db().getDocList(linkedDocType, { limit: 50, fields: displayFields, filters: filters as any });

        if (!response) {
          throw new Error(`Invalid response for DocType ${linkedDocType}`);
        }

        return response.map((item: any) => {
          const label = titleField && item[titleField.fieldname]
            ? `${item.name} - ${item[titleField.fieldname]}`
            : item.name;

          return {
            value: item.name,
            label: label,
          };
        });
      } catch (error) {
        console.error(`Error fetching options for Link field ${fieldname}:`, error);
        // Try a simpler approach as fallback
        const response = await frappe.db().getDocList(linkedDocType, { limit: 50, fields: ["name"], filters: filters as any });

        if (!response) {
          throw new Error(`Invalid response for DocType ${linkedDocType}`);
        }

        return response.map((item: any) => ({
          value: item.name,
          label: item.name,
        }));
      }
    } else if (field.fieldtype === "Select") {
      // For Select fields, parse the options string
      console.error(`Getting options for Select field ${fieldname}: ${field.options}`);

      if (!field.options) {
        return [];
      }

      return field.options.split("\n")
        .filter((option: string) => option.trim() !== '')
        .map((option: string) => ({
          value: option.trim(),
          label: option.trim(),
        }));
    } else if (field.fieldtype === "Table") {
      // For Table fields, return an empty array with a message
      console.error(`Field ${fieldname} is a Table field, no options available`);
      return [];
    } else {
      console.error(`Field ${fieldname} is type ${field.fieldtype}, not Link or Select`);
      return [];
    }
  } catch (error) {
    console.error(`Error in getFieldOptions for ${doctype}.${fieldname}:`, error);
    return handleApiError(error, `get_field_options(${doctype}, ${fieldname})`);
  }
}

/**
 * Get a list of all DocTypes in the system
 * @returns Array of DocType names
 */
export async function getAllDocTypes(): Promise<string[]> {
  try {
    const response = await frappe.db().getDocList('DocType', { limit: 1000, fields: ["name"] });

    if (!response) {
      throw new Error('Invalid response format for DocType list');
    }

    return response.map((item: any) => item.name);
  } catch (error) {
    return handleApiError(error, 'get_all_doctypes');
  }
}

/**
 * Get a list of all modules in the system
 * @returns Array of module names
 */
export async function getAllModules(): Promise<string[]> {
  try {
    const response = await frappe.db().getDocList('Module Def', { limit: 100, fields: ["name", "module_name"] });

    if (!response) {
      throw new Error('Invalid response format for Module list');
    }

    return response.map((item: any) => item.name || item.module_name);
  } catch (error) {
    return handleApiError(error, 'get_all_modules');
  }
}