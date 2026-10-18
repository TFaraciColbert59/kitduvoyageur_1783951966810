// Compas — phase 7 : lance le banc de test complet puis écrit le rapport.
//
//   COMPAS_BASE_URL=https://<aperçu>.vercel.app VERCEL_SHARE=<jeton> \
//     node scripts/compas/run-bench.mjs [arguments de playwright…]
//
// Exemples d'arguments : `tests/e2e-compas-full/ou` (une étape), `--grep @etape:kit`,
// `--workers 1`. Le code de sortie est celui de Playwright ; le rapport de
// couverture est écrit même quand des scénarios échouent.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (!process.env.COMPAS_BASE_URL) {
  console.error('[banc] COMPAS_BASE_URL est requis (aperçu Vercel à tester).');
  process.exit(2);
}
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const runDir = process.env.COMPAS_RUN_DIR ?? path.join(ROOT, 'proof/compas-full', stamp);
const env = { ...process.env, COMPAS_RUN_DIR: runDir };

const pw = spawnSync('npx', ['playwright', 'test', '--config=playwright.compas-full.config.ts', ...process.argv.slice(2)], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});
spawnSync(process.execPath, ['scripts/compas/coverage-report.mjs', runDir], { cwd: ROOT, env, stdio: 'inherit' });
process.exit(pw.status ?? 1);
