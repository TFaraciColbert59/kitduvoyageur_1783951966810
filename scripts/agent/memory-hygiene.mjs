#!/usr/bin/env node
/**
 * LKDV Agent Memory Hygiene (Hermes-style self-maintenance)
 * - Audits line & estimated token budgets of CLAUDE.md, AGENTS.md and memory/*.md
 * - Auto-archives overflow sections to memory/archive/YYYY-MM/ when --prune is passed
 * Usage: node scripts/agent/memory-hygiene.mjs [--prune]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PRUNE = process.argv.includes('--prune');

const BUDGETS = [
  { file: 'CLAUDE.md', maxLines: 190 },
  { file: 'AGENTS.md', maxLines: 120 },
  { file: 'wiki/INDEX.md', maxLines: 95 },
  { file: 'memory/USER_PROFILE.md', maxLines: 60 },
  { file: 'memory/STATE.md', maxLines: 80 },
  { file: 'memory/LESSONS.md', maxLines: 120 },
  { file: 'memory/SKILLS_REGISTRY.md', maxLines: 100 },
  { file: 'memory/RESEARCH_LOG.md', maxLines: 120 },
];

let totalTokens = 0;
let warnings = 0;

console.log('=== LKDV Agent Memory Hygiene ===');
for (const { file, maxLines } of BUDGETS) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    console.log(`⚠️  MISSING: ${file}`);
    warnings++;
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n');
  const estTokens = Math.ceil(content.length / 4);
  totalTokens += estTokens;
  const over = lines.length > maxLines;
  const icon = over ? '⚠️ ' : '✅';
  console.log(`${icon} ${file.padEnd(28)} ${String(lines.length).padStart(4)} / ${maxLines} lignes (~${estTokens} tokens)`);

  if (over) {
    warnings++;
    if (PRUNE && file.startsWith('memory/')) {
      const ym = new Date().toISOString().slice(0, 7);
      const archDir = path.join(ROOT, 'memory', 'archive', ym);
      fs.mkdirSync(archDir, { recursive: true });
      const base = path.basename(file);
      const keepLines = lines.slice(0, maxLines - 3);
      const overflow = lines.slice(maxLines - 3);
      fs.appendFileSync(
        path.join(archDir, base),
        `\n<!-- Archived ${new Date().toISOString()} -->\n${overflow.join('\n')}\n`
      );
      keepLines.push('', `> _Overflow archivé dans \`memory/archive/${ym}/${base}\`._`);
      fs.writeFileSync(full, keepLines.join('\n') + '\n');
      console.log(`   ↳ Auto-pruned ${overflow.length} lignes → memory/archive/${ym}/${base}`);
    }
  }
}

console.log(`\nTotal boot+memory footprint : ~${totalTokens} tokens`);
if (warnings > 0 && !PRUNE) {
  console.log('💡 Lance `npm run agent:hygiene -- --prune` pour archiver automatiquement les dépassements.');
}
process.exit(0);
