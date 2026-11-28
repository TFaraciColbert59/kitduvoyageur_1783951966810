#!/usr/bin/env node
/**
 * LKDV Design Guardrail Audit (`npm run design:audit`)
 * Fast static check (< 200ms) enforcing the Carnets/Clubs/Communauté Design Bible:
 * 1. No pure black (#000, #000000, #101010, #121815) in V2 Liquid Glass stylesheets
 * 2. No `.xp20-root` applied inside portaled `ExplorerNestedSubDrawer` consumers
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const V2_CSS_FILES = [
  'src/styles/carnet-v2.css',
  'src/styles/carnet-v2-lenses.css',
  'src/components/clubs/drawer/club-drawers-v2.css',
  'src/styles/communaute-v2.css',
];

const PURE_BLACK_RE = /(?:#000000|#000(?![0-9a-fA-F])|#101010|#121815)\b/g;
let issues = 0;

console.log('=== LKDV Design Bible Audit ===');

for (const rel of V2_CSS_FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  let inMaskDecl = false;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) return;
    if (/(?:-webkit-)?mask-image\s*:/.test(trimmed)) inMaskDecl = true;
    if (!inMaskDecl) {
      const m = line.match(PURE_BLACK_RE);
      if (m) {
        console.error(`❌ Pure black forbidden in ${rel}:${idx + 1} → ${m.join(', ')}`);
        issues++;
      }
    }
    if (inMaskDecl && trimmed.includes(';')) inMaskDecl = false;
  });
}

const summarySubDrawer = path.join(ROOT, 'src/features/explorer-v2/redesign/summary/SummaryExpertAnalysisSubDrawer.tsx');
if (fs.existsSync(summarySubDrawer)) {
  const src = fs.readFileSync(summarySubDrawer, 'utf8');
  if (src.includes('xp20-root')) {
    console.error('❌ Forbidden `.xp20-root` found in SummaryExpertAnalysisSubDrawer.tsx (must use `.xp20-exp-scope`).');
    issues++;
  }
}

if (issues === 0) {
  console.log('✅ Design Bible audit passed (0 pure-black violations, 0 portaled `.xp20-root` leaks).');
  process.exit(0);
} else {
  console.error(`\n❌ Design Bible audit failed with ${issues} violation(s).`);
  process.exit(1);
}
