// Compas — phase 7 : rapport de couverture du banc de test.
//
// Croise l'inventaire statique (docs/compas/phase7/inventaire-controles.json),
// ce que les scénarios ont réellement fait dans le navigateur
// (<passage>/coverage-runtime.json) et le registre
// (tests/e2e-compas-full/coverage-registry.json). Écrit dans le dossier du passage :
//   coverage-report.json   chiffres et listes exactes (machine)
//   coverage-report.md     tableau de bord + chaque contrôle NON exercé avec sa raison
//   scoreboard.md          tableau de bord seul (réussi / échoué / non couvert par étape)
//
// Usage :
//   node scripts/compas/coverage-report.mjs [passage…] [--strict]
//   sans argument : le dernier passage de proof/compas-full/.
//   plusieurs passages : leurs enregistrements sont réunis (rapport dans le premier).
//   --strict : code de sortie 1 tant que la couverture n'est pas de 100 %.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCoverage, coverageMarkdown, pctText, scoreboardMarkdown, testsByEtape } from './lib/coverage-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
let runs = args.filter((a) => !a.startsWith('--'));
if (!runs.length) {
  const base = path.join(ROOT, 'proof/compas-full');
  const dirs = fs.existsSync(base)
    ? fs
        .readdirSync(base)
        .filter((d) => fs.existsSync(path.join(base, d, 'coverage-runtime.json')))
        .sort()
    : [];
  if (!dirs.length) {
    console.error('[couverture] aucun passage dans proof/compas-full/ : lancer d’abord le banc (voir docs/compas/phase7/BANC-DE-TEST.md).');
    process.exit(2);
  }
  runs = [path.join(base, dirs[dirs.length - 1])];
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const inventory = readJson(path.join(ROOT, 'docs/compas/phase7/inventaire-controles.json'));
const registry = readJson(path.join(ROOT, 'tests/e2e-compas-full/coverage-registry.json'));
const records = runs.flatMap((r) => {
  const f = path.join(r, 'coverage-runtime.json');
  return fs.existsSync(f) ? readJson(f) : [];
});

// Résultats des scénarios (reporter JSON de Playwright), additionnés par étape.
const tests = {};
for (const r of runs) {
  const f = path.join(r, 'report.json');
  if (!fs.existsSync(f)) continue;
  for (const [etape, row] of Object.entries(testsByEtape(readJson(f)))) {
    const acc = (tests[etape] ??= { passed: 0, failed: 0, skipped: 0 });
    acc.passed += row.passed;
    acc.failed += row.failed;
    acc.skipped += row.skipped;
  }
}

const cov = computeCoverage({ inventory, records, registry });
const out = runs[0];
fs.writeFileSync(
  path.join(out, 'coverage-report.json'),
  JSON.stringify({ passages: runs.map((r) => path.relative(ROOT, r)), tests, ...cov }, null, 2) + '\n'
);
fs.writeFileSync(path.join(out, 'coverage-report.md'), coverageMarkdown(cov, tests) + '\n');
fs.writeFileSync(path.join(out, 'scoreboard.md'), scoreboardMarkdown(cov, tests) + '\n');

console.info(scoreboardMarkdown(cov, tests));
console.info(`[couverture] ${cov.global.verifies} / ${cov.global.total} contrôles vérifiés (${pctText(cov.global.pourcentage)}) → ${path.relative(ROOT, out)}/coverage-report.md`);
if (strict && cov.global.verifies < cov.global.total) process.exit(1);
