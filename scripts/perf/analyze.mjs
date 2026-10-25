/**
 * PERF — Analyse de bundle (P2).
 * Lance un build de production avec l'analyseur @next/bundle-analyzer activé.
 * Rapports générés (sans serveur web) : .next/analyze/client.html et nodejs.html
 *
 * Usage : node scripts/perf/analyze.mjs
 */
import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const command = isWindows ? 'npm.cmd' : 'npm';

console.log('[analyze] build avec ANALYZE=true...');
const result = spawnSync(command, ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, ANALYZE: 'true' },
  shell: isWindows,
});

if (result.status !== 0) {
  console.error('[analyze] échec du build analysé (exit ' + result.status + ')');
  process.exit(result.status ?? 1);
}

console.log('[analyze] terminé — rapports : .next/analyze/client.html et .next/analyze/nodejs.html');
