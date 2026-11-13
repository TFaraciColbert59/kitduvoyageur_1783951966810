/**
 * PERF — Applique les budgets Lighthouse de `.lighthouserc.json` au rapport JSON
 * produit par `npx lighthouse` dans `.lighthouseci/report.json`.
 *
 * Pourquoi ce script : le workflow lance `npx lighthouse` directement, donc
 * `.lighthouserc.json` n'était jamais lu. Ici, il devient la source unique des
 * seuils, sans ajouter @lhci/cli.
 *
 * Usage :
 *   node scripts/perf/assert-lighthouse.mjs
 *   node scripts/perf/assert-lighthouse.mjs .lighthouseci/report.json
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, '.lighthouserc.json');
const reportPath = process.argv[2] ?? path.join(root, '.lighthouseci', 'report.json');

if (!fs.existsSync(reportPath)) {
  console.error(`[lighthouse-budget] rapport introuvable : ${reportPath}`);
  console.error('[lighthouse-budget] Lighthouse n’a pas produit de rapport — build ou serveur en échec.');
  process.exit(1);
}
if (!fs.existsSync(configPath)) {
  console.error(`[lighthouse-budget] configuration introuvable : ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const assertions = config?.ci?.assert?.assertions ?? {};

function severityOf(value) {
  if (value === 'off') return 'off';
  if (Array.isArray(value)) return value[0] ?? 'error';
  return 'error';
}

function optionsOf(value) {
  return Array.isArray(value) && value[1] && typeof value[1] === 'object' ? value[1] : {};
}

function measure(key) {
  if (key.startsWith('categories:')) {
    const id = key.slice('categories:'.length);
    const score = report.categories?.[id]?.score;
    return typeof score === 'number' ? { actual: score, unit: 'score' } : null;
  }
  const audit = report.audits?.[key];
  if (!audit || typeof audit.numericValue !== 'number') return null;
  return { actual: audit.numericValue, unit: audit.numericUnit ?? 'ms' };
}

const rows = [];
let failed = 0;
let warned = 0;

for (const [key, value] of Object.entries(assertions)) {
  const severity = severityOf(value);
  if (severity === 'off') continue;
  const options = optionsOf(value);
  const measured = measure(key);
  if (!measured) {
    rows.push({ key, severity, actual: 'n/a', target: 'n/a', status: 'IGNORÉ' });
    continue;
  }

  let ok = true;
  let target = '';
  if (typeof options.minScore === 'number') {
    ok = measured.actual >= options.minScore;
    target = `≥ ${options.minScore}`;
  }
  if (typeof options.maxNumericValue === 'number') {
    ok = measured.actual <= options.maxNumericValue;
    target = `≤ ${options.maxNumericValue} ${measured.unit}`;
  }
  if (!target) {
    rows.push({ key, severity, actual: String(measured.actual), target: 'n/a', status: 'IGNORÉ' });
    continue;
  }

  const status = ok ? 'OK' : severity === 'error' ? 'ÉCHEC' : 'ALERTE';
  if (!ok && severity === 'error') failed += 1;
  if (!ok && severity === 'warn') warned += 1;
  const display =
    measured.unit === 'score'
      ? measured.actual.toFixed(2)
      : measured.unit === 'unitless'
        ? measured.actual.toFixed(3)
        : `${Math.round(measured.actual)} ${measured.unit}`;
  rows.push({
    key,
    severity,
    actual: display,
    target,
    status,
  });
}

console.log('\n[lighthouse-budget] Budgets Lighthouse (source : .lighthouserc.json)\n');
console.log('| Assertion | Sévérité | Mesure | Cible | Statut |');
console.log('|---|---|---:|---:|---|');
for (const row of rows) {
  console.log(`| \`${row.key}\` | ${row.severity} | ${row.actual} | ${row.target} | ${row.status} |`);
}

if (failed > 0) {
  console.error(`\n[lighthouse-budget] ${failed} budget(s) en échec.`);
  process.exit(1);
}

console.log(`\n[lighthouse-budget] OK — ${warned} alerte(s), 0 échec.`);
