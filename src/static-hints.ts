import fs from 'fs';
import path from 'path';

/**
 * Interface for a static hint
 */
export interface Hint {
  type: "doctype" | "workflow";
  target: string;
  hint?: string;
  id?: string;
  description?: string;
  steps?: string[];
  related_doctypes?: string[];
}

/**
 * Indexed structure for static hints
 */
export interface StaticHints {
  doctype: Map<string, Hint[]>;
  workflow: Map<string, Hint[]>;
}

// Global variable to store indexed hints
let staticHints: StaticHints = {
  doctype: new Map(),
  workflow: new Map(),
};

/**
 * Load all hint files from the static_hints directory
 * @returns The loaded and indexed hints
 */
export async function loadStaticHints(): Promise<StaticHints> {
  console.error('Loading static hints...');
  
  const hintsDir = path.join(process.cwd(), 'src', 'server_hints'); // Changed path
  
  // Directory creation logic removed
  
  // Reset the hints
  staticHints = {
    doctype: new Map(),
    workflow: new Map(),
  };
  
  try {
    // Read all JSON files in the directory
    const files = fs.readdirSync(hintsDir).filter(file => file.endsWith('.json'));
    console.error(`Found ${files.length} hint files`);
    
    for (const file of files) {
      try {
        const filePath = path.join(hintsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const hints = JSON.parse(content) as Hint[];
        
        if (!Array.isArray(hints)) {
          console.error(`Invalid hint file format in ${file}: expected an array of hints`);
          continue;
        }
        
        // Index the hints
        for (const hint of hints) {
          if (!hint.type || !hint.target) {
            console.error(`Invalid hint in ${file}: missing type or target`);
            continue;
          }
          
          // Validate hint structure based on type
          if (hint.type === 'doctype' && !hint.hint) {
            console.error(`Invalid doctype hint in ${file}: missing hint text`);
            continue;
          }
          
          if (hint.type === 'workflow' && (!hint.steps || !Array.isArray(hint.steps))) {
            console.error(`Invalid workflow hint in ${file}: missing or invalid steps`);
            continue;
          }
          
          // Add to the appropriate map
          const map = staticHints[hint.type];
          const existing = map.get(hint.target) || [];
          existing.push(hint);
          map.set(hint.target, existing);
        }
        
        console.error(`Indexed hints from ${file}`);
      } catch (error) {
        console.error(`Error processing hint file ${file}:`, error);
      }
    }
    
    // Log summary
    console.error(`Loaded ${staticHints.doctype.size} DocType hints and ${staticHints.workflow.size} workflow hints`);
    
    return staticHints;
  } catch (error) {
    console.error('Error loading static hints:', error);
    return staticHints;
  }
}

/**
 * Get hints for a specific DocType
 * @param doctype The DocType name
 * @returns Array of hints for the DocType, or empty array if none found
 */
export function getDocTypeHints(doctype: string): Hint[] {
  return staticHints.doctype.get(doctype) || [];
}

/**
 * Get hints for a specific workflow
 * @param workflow The workflow name
 * @returns Array of hints for the workflow, or empty array if none found
 */
export function getWorkflowHints(workflow: string): Hint[] {
  return staticHints.workflow.get(workflow) || [];
}

/**
 * Find workflow hints that involve a specific DocType
 * @param doctype The DocType name
 * @returns Array of workflow hints that involve the DocType
 */
export function findWorkflowsForDocType(doctype: string): Hint[] {
  const results: Hint[] = [];
  
  for (const [_, hints] of staticHints.workflow.entries()) {
    for (const hint of hints) {
      if (hint.related_doctypes && hint.related_doctypes.includes(doctype)) {
        results.push(hint);
      }
    }
  }
  
  return results;
}

/**
 * Initialize the static hints system
 * This should be called during server startup
 */
export async function initializeStaticHints(): Promise<void> {
  await loadStaticHints();
}