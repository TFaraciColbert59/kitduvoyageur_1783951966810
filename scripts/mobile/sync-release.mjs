#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export function syncRelease(args = []) {
  if (process.env.CAPACITOR_DEV_SERVER === '1') {
    throw new Error('CAPACITOR_DEV_SERVER est interdit pour une synchronisation release.');
  }
  const cli = join(dirname(require.resolve('@capacitor/cli/package.json')), 'bin', 'capacitor');
  const result = spawnSync(process.execPath, [cli, 'sync', ...args], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = syncRelease(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Capacitor release sync failed.');
    process.exitCode = 1;
  }
}
