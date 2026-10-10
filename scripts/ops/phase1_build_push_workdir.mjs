import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SCRATCH = 'C:\\Users\\Tony\\AppData\\Local\\Temp\\opencode\\phase1-push';
const MIG_DIR = path.join(SCRATCH, 'supabase', 'migrations');

const res = spawnSync('npx.cmd', ['supabase', 'migration', 'list', '--linked'], {
  cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 50 * 1024 * 1024,
});
const line = (res.stdout || '').split(/\r?\n/).find((l) => l.trim().startsWith('{"migrations"'));
if (!line) {
  console.error('Sortie migration list illisible', res.stdout?.slice(0, 500), res.stderr?.slice(0, 500));
  process.exit(1);
}
const { migrations } = JSON.parse(line);

const remote = new Set(migrations.filter((m) => m.remote).map((m) => m.remote));
const localOnly = migrations.filter((m) => m.local && !m.remote).map((m) => m.local);
const remoteOnly = migrations.filter((m) => !m.local && m.remote).map((m) => m.remote);
const BOTH = migrations.filter((m) => m.local && m.remote).map((m) => m.local);

console.log('local-only (exclues du workdir):', localOnly.join(', ') || '(aucune)');
console.log('remote-only (placeholders vides):', remoteOnly.length);
console.log('communes:', BOTH.length);

fs.rmSync(MIG_DIR, { recursive: true, force: true });
fs.mkdirSync(MIG_DIR, { recursive: true });

const localFiles = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'));
let copied = 0;
let placeholders = 0;
let missing = [];

for (const version of BOTH) {
  const file = localFiles.find((f) => f.startsWith(version + '_'));
  if (!file) { missing.push(version); continue; }
  fs.copyFileSync(path.join(ROOT, 'supabase', 'migrations', file), path.join(MIG_DIR, file));
  copied++;
}
for (const version of remoteOnly) {
  fs.writeFileSync(path.join(MIG_DIR, `${version}_remote_placeholder.sql`), `-- placeholder (version enregistrée côté distant, absente du dépôt)\n`);
  placeholders++;
}
const OURS = ['20261010140000_phase1_balance_lockdown.sql', '20261010150000_loyalty_idempotence_user_scoped.sql', '20261010160000_phase1_demo_isolation.sql', '20261010170000_phase1_reconcile_i4.sql'];
for (const f of OURS) {
  fs.copyFileSync(path.join(ROOT, 'supabase', 'migrations', f), path.join(MIG_DIR, f));
}

console.log(JSON.stringify({ copied, placeholders, missing, ours: OURS }, null, 2));
