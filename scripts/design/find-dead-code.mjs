#!/usr/bin/env node
/**
 * find-dead-code.mjs — audit de code mort du front LKDV (Phase 1 / Phase 2).
 *
 * Construit le graphe d'imports de src/ (statique + dynamique + require),
 * depuis les points d'entrée réels :
 *   - routes App Router (page/layout/route/loading/error/not-found/…),
 *   - src/middleware.ts,
 *   - tests/ et scripts/ (leurs imports protègent le code testé),
 *   - src/**\/__tests__/** (exécutés par vitest).
 *
 * Sortie : liste des fichiers inatteignables, séparés en
 *   - "deletable"  : code non métier (ancien design, doublons) ;
 *   - "protected"  : code métier staging (features/, lib/, hooks/…) — à
 *     arbitrer produit avant toute suppression.
 *
 * Usage :
 *   node scripts/design/find-dead-code.mjs            # résumé + liste
 *   node scripts/design/find-dead-code.mjs --json     # JSON sur stdout
 *
 * Ne modifie jamais le disque.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const EXT = ['.tsx', '.ts', '.css', '.jsx', '.js'];
const PROTECTED_PREFIXES = [
  'src/features/',
  'src/lib/',
  'src/hooks/',
  'src/server/',
  'src/contexts/',
  'src/constants/',
  'src/types/',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__snapshots__') continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

const srcFiles = walk(SRC).filter((f) => EXT.includes(path.extname(f)));
const srcSet = new Set(srcFiles.map((f) => path.resolve(f)));

function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  const candidates = [
    base,
    ...EXT.map((e) => base + e),
    ...EXT.map((e) => path.join(base, 'index' + e)),
  ];
  for (const c of candidates) {
    const r = path.resolve(c);
    if (srcSet.has(r)) return r;
  }
  return null;
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;

function edgesOf(file) {
  const content = fs.readFileSync(file, 'utf8');
  const out = new Set();
  for (const m of content.matchAll(IMPORT_RE)) {
    const resolved = resolveSpec(m[1], file);
    if (resolved) out.add(resolved);
  }
  return out;
}

const edges = new Map();
for (const f of srcFiles) edges.set(path.resolve(f), edgesOf(f));

function isAppEntry(p) {
  const rel = path.relative(SRC, p).split(path.sep).join('/');
  if (!rel.startsWith('app/')) return false;
  const base = path.basename(rel).replace(path.extname(rel), '');
  return [
    'page', 'layout', 'route', 'loading', 'error', 'global-error', 'not-found',
    'template', 'default', 'sitemap', 'robots', 'manifest', 'icon',
    'opengraph-image', 'twitter-image', 'instrumentation',
  ].includes(base);
}

const roots = new Set();
for (const f of srcFiles) {
  const abs = path.resolve(f);
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  const isTest = rel.includes('__tests__/');
  if (isAppEntry(f) || rel === 'middleware.ts' || isTest) roots.add(abs);
}

for (const dir of ['tests', 'scripts']) {
  for (const f of walk(path.join(ROOT, dir))) {
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(f)) continue;
    const content = fs.readFileSync(f, 'utf8');
    for (const m of content.matchAll(IMPORT_RE)) {
      const r = resolveSpec(m[1], f);
      if (r) roots.add(r);
    }
  }
}

const reachable = new Set(roots);
const queue = [...roots];
while (queue.length) {
  const cur = queue.pop();
  for (const e of edges.get(cur) ?? []) {
    if (!reachable.has(e)) {
      reachable.add(e);
      queue.push(e);
    }
  }
}

const dead = srcFiles.filter((f) => !reachable.has(path.resolve(f)));
const relOf = (f) => path.relative(ROOT, f).split(path.sep).join('/');

const protectedDead = new Set();
function protect(f) {
  const abs = path.resolve(f);
  if (protectedDead.has(abs)) return;
  protectedDead.add(abs);
  for (const e of edges.get(abs) ?? []) protect(e);
}
for (const d of dead) {
  if (PROTECTED_PREFIXES.some((p) => relOf(d).startsWith(p))) protect(d);
}

const deletable = dead
  .filter((d) => !protectedDead.has(path.resolve(d)))
  .map(relOf)
  .sort();
const protectedList = [...protectedDead]
  .filter((d) => dead.includes(d))
  .map(relOf)
  .sort();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ deletable, protectedDead: protectedList }, null, 2));
} else {
  console.log(`src files        : ${srcFiles.length}`);
  console.log(`reachable        : ${reachable.size}`);
  console.log(`dead             : ${dead.length}`);
  console.log(`deletable        : ${deletable.length}`);
  console.log(`protected (métier): ${protectedList.length}\n`);
  for (const f of deletable) console.log(`  D ${f}`);
  console.log('\nProtégés (staging métier, ne pas supprimer sans arbitrage) :');
  for (const f of protectedList) console.log(`  P ${f}`);
}
