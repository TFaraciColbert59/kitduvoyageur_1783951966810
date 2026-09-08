#!/usr/bin/env node
/**
 * Y1.5/Y3.5 — Compteur de violations Y-D80.
 * Régénère docs/Y_VIOLATIONS.md (détail par règle/fichier) + un JSON brut
 * docs/y-violations-raw.json (usage interne). Même logique que le spec vitest.
 * Usage : node scripts/design/y-d80-count.mjs [--json-only]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCOPE = ['src/features/trips', 'src/app/voyages', 'src/app/groupes', 'src/app/ai-configurator'];
const ALLOW = new Set(['#ffffff', '#fff', '#000000', '#000']);
const R11_ALLOW = [
  'src/features/trips/registry/tripSectionRegistry.ts',
  'src/features/trips/registry/tripPaths.ts',
];

function files(dir, acc = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return acc;
  for (const e of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const V = [];
for (const dir of SCOPE) {
  for (const f of files(dir)) {
    const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const lines = c.split(/\r?\n/);
    const push = (rule, i, l) => V.push({ rule, file: f.split(path.sep).join('/'), line: i + 1, extract: l.trim().slice(0, 120) });
    lines.forEach((l, i) => {
      if (/\b(?:bg|text|border|ring|stroke|fill|from|via|to|hover:bg|hover:text|divide)-(?:zinc|gray|slate|amber|emerald|blue|red|orange)-\d+/.test(l)) push('R1', i, l);
      const hexMatches = Array.from(l.matchAll(/#[0-9a-fA-F]{3,8}\b/g));
      for (const m of hexMatches) {
        if (!ALLOW.has(m[0].toLowerCase())) push('R2', i, l);
      }
      if (/\brounded-\[\d+px\]/.test(l)) push('R3', i, l);
      if (/\bshadow-\[[^\]]+\]/.test(l)) push('R4', i, l);
      if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(l)) push('R5', i, l);
      if (/\bmin-[hw]-\[(?:[0-3]?\d|4[0-3])px\]/.test(l)) push('R6', i, l);
      if (/<(?:select|input)(?![^>]*className=)[^>]*>/.test(l)) push('R7', i, l);
      if (/navigator\.onLine|@capacitor\/network/.test(l) && !/TripNetworkStatus|networkStatus|useOnlineStatus/.test(f)) push('R8', i, l);
      const fSlash = f.split(path.sep).join('/');
      if (/['"`]\/voyages\/[^'"`]*['"`]/.test(l) && !R11_ALLOW.includes(fSlash)) push('R11', i, l);
      if (/`\/voyages\/\$\{[^}]+\}\/(?!gpx)[a-z]+/.test(l) && !R11_ALLOW.includes(fSlash)) push('R11', i, l);
      if (/window\.print\s*\(/.test(l)) push('R12', i, l);
    });
    const h1 = (c.match(/<h1[\s>]/g) || []).length;
    if (h1 > 1) V.push({ rule: 'R9', file: f.split(path.sep).join('/'), line: 0, extract: `${h1} <h1>` });
    if (/<aside[\s>]/.test(c) && !f.endsWith('layout.tsx') && !/TripSidebar(Left|Right)\.tsx$/.test(f)) {
      V.push({ rule: 'R10', file: f.split(path.sep).join('/'), line: 0, extract: '<aside' });
    }
  }
}

const byRule = {};
for (const v of V) byRule[v.rule] = (byRule[v.rule] || 0) + 1;
fs.writeFileSync(path.join(ROOT, 'docs', 'y-violations-raw.json'), JSON.stringify(V, null, 1));
console.log('TOTAL:', V.length, JSON.stringify(byRule));

if (!process.argv.includes('--json-only')) {
  const RULE_NAMES = {
    R1: 'Classes froides', R2: 'Hex brut', R3: 'rounded-[Npx]', R4: 'shadow-[…]',
    R5: 'Dialogues natifs', R6: 'Cibles < 44px', R7: 'Contrôles non stylés',
    R8: 'Statut réseau multiple', R9: 'h1 multiples', R10: 'aside hors canonique',
    R11: 'Routes littérales', R12: 'window.print',
  };
  const PHASE = { R8: 'Y3.2', R10: 'Y2.2/Y3.1', R11: 'Y3.5', R12: 'Y4.10' };
  let md = `# Y_VIOLATIONS — Inventaire du garde-fou Y-D80\n\nRégénéré le ${new Date().toISOString()}\nTotal : **${V.length} violations** · Cible : 0 (G3 = 12/12 en fin de Y3.5).\n\n`;
  md += '| Règle | Objet | Total | Phase |\n|---|---|---|---|\n';
  for (const r of Object.keys(RULE_NAMES)) {
    md += `| ${r} | ${RULE_NAMES[r]} | ${byRule[r] ?? 0} | ${PHASE[r] ?? 'Y3.5'} |\n`;
  }
  md += '\n## Détail par règle (fichiers les plus touchés)\n\n';
  for (const r of Object.keys(RULE_NAMES)) {
    const items = V.filter((v) => v.rule === r);
    md += `### ${r} — ${RULE_NAMES[r]} (${items.length})\n\n`;
    const counts = {};
    for (const v of items) counts[v.file] = (counts[v.file] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    md += top.map(([f, n]) => `- \`${f}\` × ${n}`).join('\n');
    if (Object.keys(counts).length > 12) md += `\n- … +${Object.keys(counts).length - 12} autres fichiers`;
    md += '\n\n';
  }
  fs.writeFileSync(path.join(ROOT, 'docs', 'Y_VIOLATIONS.md'), md);
  console.log('docs/Y_VIOLATIONS.md régénéré');
}
