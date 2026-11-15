import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./demo_population/seed.py', import.meta.url));
const result = spawnSync(process.env.LKDV_DEMO_PYTHON ?? 'python3', [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
}
process.exitCode = result.status ?? 1;
