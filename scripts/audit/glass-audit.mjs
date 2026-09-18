#!/usr/bin/env node
/**
 * Glass audit script — identifies non-canonical glass usage in LKDV src/
 * Usage: node scripts/audit/glass-audit.mjs [--output path/to/report.json]
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');
const SRC = join(ROOT, 'src');

const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.next', '.git'].includes(entry.name)) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

const results = {
  timestamp: new Date().toISOString(),
  glassCardUsages: 0,
  issues: [],
  deletedImports: [],
  inlineBackdropFilter: [],
  cssOverrides: [],
};

for await (const file of walk(SRC)) {
  const ext = extname(file);
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  
  if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
    const content = await readFile(file, 'utf8');
    
    // Count canonical GlassCard usage
    if (content.includes('GlassCard')) results.glassCardUsages++;
    
    // Check for deleted imports
    if (content.includes('@/components/ui/liquid-glass') || content.includes('@/components/ui-layouts/liquid-glass')) {
      results.deletedImports.push({ file: rel, note: 'imports deleted liquid-glass module' });
    }
    
    // Check for inline backdrop-filter in style props
    if (/style[=\s]*\{[^}]*backdrop[Ff]ilter/.test(content)) {
      results.inlineBackdropFilter.push({ file: rel, note: 'inline backdropFilter in style prop' });
    }
    
    // Check for inline style string with backdrop-filter
    if (/style=["'][^"']*backdrop-filter/.test(content)) {
      results.inlineBackdropFilter.push({ file: rel, note: 'inline backdrop-filter string in style' });
    }
  }
  
  if (ext === '.css' && !rel.includes('liquid-glass.css') && !rel.includes('tokens.css') && !rel.includes('.module.css')) {
    const content = await readFile(file, 'utf8');
    if (content.includes('backdrop-filter') && !content.includes('/* glass-policy-exempt */')) {
      results.cssOverrides.push({ file: rel, note: 'defines backdrop-filter outside canonical system' });
    }
  }
}

// Deduplicate
results.inlineBackdropFilter = [...new Map(results.inlineBackdropFilter.map(x => [x.file, x])).values()];

// Summary
const totalIssues = results.deletedImports.length + results.inlineBackdropFilter.length + results.cssOverrides.length;
console.log('\n=== LKDV Glass Audit ===');
console.log(`✅ GlassCard usages: ${results.glassCardUsages}`);
console.log(`❌ Deleted imports still referenced: ${results.deletedImports.length}`);
console.log(`⚠️ Inline backdrop-filter: ${results.inlineBackdropFilter.length}`);
console.log(`⚠️ CSS overrides outside system: ${results.cssOverrides.length}`);
console.log(`\nTotal issues: ${totalIssues}`);

if (results.deletedImports.length) {
  console.log('\nDeleted imports:');
  results.deletedImports.forEach(i => console.log(` - ${i.file}: ${i.note}`));
}
if (results.inlineBackdropFilter.length) {
  console.log('\nInline backdrop-filter:');
  results.inlineBackdropFilter.forEach(i => console.log(` - ${i.file}: ${i.note}`));
}
if (results.cssOverrides.length) {
  console.log('\nCSS overrides:');
  results.cssOverrides.forEach(i => console.log(` - ${i.file}: ${i.note}`));
}

if (outputPath) {
  const dir = dirname(outputPath);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nReport saved to ${outputPath}`);
}
