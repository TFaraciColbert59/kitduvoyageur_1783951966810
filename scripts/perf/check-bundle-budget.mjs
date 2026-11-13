/**
 * PERF — Vérifie les budgets de bundle par route après un build de production.
 *
 * Lit `.next/app-build-manifest.json` (Next 15 App Router), calcule la taille
 * gzip des fichiers JS de chaque route listée dans `bundle-budgets.json`, et
 * échoue si une route dépasse son budget.
 *
 * Usage :
 *   node scripts/perf/check-bundle-budget.mjs
 *   node scripts/perf/check-bundle-budget.mjs --top 20
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const distIndex = process.argv.indexOf('--dist');
const distDir = distIndex === -1 ? '.next' : process.argv[distIndex + 1];
const manifestPath = path.join(root, distDir, 'app-build-manifest.json');
const budgetsPath = path.join(root, 'scripts', 'perf', 'bundle-budgets.json');
const topIndex = process.argv.indexOf('--top');
const topCount = topIndex === -1 ? 10 : Number(process.argv[topIndex + 1] || 10);

if (!fs.existsSync(manifestPath)) {
  console.error(`[bundle-budget] manifest introuvable : ${manifestPath}`);
  console.error('[bundle-budget] lance `npm run build` avant ce script.');
  process.exit(1);
}
if (!fs.existsSync(budgetsPath)) {
  console.error(`[bundle-budget] budgets introuvables : ${budgetsPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const budgets = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));
const pages = manifest.pages ?? {};

const gzipCache = new Map();
function gzipSize(relativeFile) {
  if (gzipCache.has(relativeFile)) return gzipCache.get(relativeFile);
  const absolute = path.join(root, distDir, relativeFile);
  let size = 0;
  try {
    size = zlib.gzipSync(fs.readFileSync(absolute), { level: 9 }).length;
  } catch {
    size = 0;
  }
  gzipCache.set(relativeFile, size);
  return size;
}

function routeSize(route) {
  const files = pages[route] ?? [];
  return files.filter((file) => file.endsWith('.js')).reduce((total, file) => total + gzipSize(file), 0);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} Ko`;
const tolerance = Number(budgets.tolerancePercent ?? 0);
const rows = [];

for (const [route, budgetBytes] of Object.entries(budgets.routes ?? {})) {
  if (!pages[route]) {
    rows.push({ route, size: null, budget: budgetBytes, status: 'ABSENT' });
    continue;
  }
  const size = routeSize(route);
  const ceiling = budgetBytes * (1 + tolerance / 100);
  rows.push({ route, size, budget: budgetBytes, status: size > ceiling ? 'DÉPASSÉ' : 'OK' });
}

console.log('\n[bundle-budget] Budgets de bundle (JS gzip, par route)\n');
console.log('| Route | Taille | Budget | Statut |');
console.log('|---|---:|---:|---|');
for (const row of rows) {
  const size = row.size === null ? '—' : kb(row.size);
  console.log(`| \`${row.route}\` | ${size} | ${kb(row.budget)} | ${row.status} |`);
}

const allRoutes = Object.keys(pages)
  .map((route) => ({ route, size: routeSize(route) }))
  .sort((a, b) => b.size - a.size)
  .slice(0, topCount);

console.log(`\n[bundle-budget] Top ${topCount} des routes les plus lourdes\n`);
console.log('| Route | Taille |');
console.log('|---|---:|');
for (const row of allRoutes) {
  console.log(`| \`${row.route}\` | ${kb(row.size)} |`);
}

const missing = rows.filter((row) => row.status === 'ABSENT');
const exceeded = rows.filter((row) => row.status === 'DÉPASSÉ');

if (missing.length > 0) {
  console.error(`\n[bundle-budget] routes absentes du manifest : ${missing.map((row) => row.route).join(', ')}`);
}
if (exceeded.length > 0) {
  console.error(`\n[bundle-budget] ${exceeded.length} route(s) au-dessus du budget (+${tolerance}% tolérés) :`);
  for (const row of exceeded) {
    console.error(`  - ${row.route} : ${kb(row.size)} > ${kb(row.budget)}`);
  }
  process.exit(1);
}

console.log('\n[bundle-budget] OK — tous les budgets sont respectés.');
