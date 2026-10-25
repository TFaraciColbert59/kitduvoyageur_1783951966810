import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { RUN_DIR } from './_lib/env';

/**
 * Fin de passage : réunit les enregistrements des workers dans
 * `coverage-runtime.json`, puis écrit le rapport de couverture et le tableau
 * de bord (scripts/compas/coverage-report.mjs). Le rapport JSON de Playwright
 * est écrit APRÈS ce démontage : le tableau de bord le relit s'il existe, sinon
 * relancer `node scripts/compas/coverage-report.mjs <passage>`.
 */
export default async function globalTeardown() {
  const dir = path.join(RUN_DIR, 'coverage');
  const records = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.jsonl'))
        .sort()
        .flatMap((f) =>
          fs
            .readFileSync(path.join(dir, f), 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as unknown)
        )
    : [];
  fs.writeFileSync(path.join(RUN_DIR, 'coverage-runtime.json'), JSON.stringify(records, null, 1) + '\n');
  try {
    execFileSync(process.execPath, ['scripts/compas/coverage-report.mjs', RUN_DIR], { stdio: 'inherit' });
  } catch (e) {
    console.warn('[compas-full] rapport de couverture non écrit :', String(e).slice(0, 200));
  }
}
