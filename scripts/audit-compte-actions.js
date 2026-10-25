const fs = require('fs');

const runtimePath = 'src/components/compte/compte-liquid-glass-v8-runtime.js';
const content = fs.readFileSync(runtimePath, 'utf8');

// Find all data-a attributes
const dataActions = new Set();
const actionMatches = content.matchAll(/data-a=["']([^"']+)["']/g);
for (const m of actionMatches) dataActions.add(m[1]);

// Find all switch-case actions in act(a, v, el)
const cases = new Set();
const caseMatches = content.matchAll(/case\s+["']([^"']+)["']\s*:/g);
for (const m of caseMatches) cases.add(m[1]);

// Find sheets
const sheets = new Set();
const sheetMatches = content.matchAll(/openSheet\(["']([^"']+)["']/g);
for (const m of sheetMatches) sheets.add(m[1]);

// Find SHEETS object keys
const sheetsObjMatches = content.match(/const SHEETS\s*=\s*\{([\s\S]*?)\n\};/);

console.log('=== DATA-A ACTIONS (' + dataActions.size + ') ===');
console.log(Array.from(dataActions).sort().join('\n'));

console.log('\n=== SWITCH-CASE ACTIONS (' + cases.size + ') ===');
console.log(Array.from(cases).sort().join('\n'));

console.log('\n=== OPEN SHEETS (' + sheets.size + ') ===');
console.log(Array.from(sheets).sort().join('\n'));
