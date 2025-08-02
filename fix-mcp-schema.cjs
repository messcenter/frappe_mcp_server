const fs = require('fs');
const path = require('path');

const files = [
  '/build/frappe-instructions.js',
  '/build/document-operations.js',
  '/build/schema-operations.js'
];

const baseDir = path.join(require('path').dirname(require.resolve('frappe-mcp-server/package.json')));

files.forEach(file => {
    const fullPath = path.join(baseDir, file);
    if (!fs.existsSync(fullPath)) {
        console.log(`Dosya bulunamadı: ${fullPath}`);
        return;
    }
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/inputSchema:\s*{[^}]*}/g, 'inputSchema: { type: "object", properties: {}, additionalProperties: true }');
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Patched: ${fullPath}`);
});
