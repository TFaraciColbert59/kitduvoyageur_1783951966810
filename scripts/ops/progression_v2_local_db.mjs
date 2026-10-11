#!/usr/bin/env node
/** Strict migration replay on the explicitly isolated Docker container only. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const container = 'lkdv-v2-test';
const database = process.argv[2] ?? 'postgres';
if (!['postgres', 'lkdv_restore', 'lkdv_rollback'].includes(database)) throw new Error('Isolated database name required');
const evidenceDir = '/tmp/lkdv-v2-db';
fs.mkdirSync(evidenceDir, { recursive: true });
const runSql = (sql, label) => {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-q', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  fs.appendFileSync(path.join(evidenceDir, `migration-${database}.log`), `\n${label}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (result.status !== 0) {
    console.error(`${label}: exit ${result.status}\n${result.stderr}`);
    process.exit(result.status ?? 1);
  }
  console.log(`ok ${label}`);
};
const ledger = new Set(fs.readFileSync(path.join(root, 'supabase/baseline/applied_migrations.txt'), 'utf8').split(/\s+/).filter(Boolean));
runSql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, name text, statements text[]);', 'migration ledger');
for (const version of ledger) {
  if (!/^\d+$/.test(version)) throw new Error('Unexpected baseline ledger version');
  runSql(`INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('${version}') ON CONFLICT DO NOTHING;`, `baseline version ${version}`);
}
const applied = spawnSync('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-At', '-c', 'SELECT version FROM supabase_migrations.schema_migrations'], { encoding: 'utf8' });
if (applied.status !== 0) throw new Error('Cannot read local migration ledger');
for (const version of applied.stdout.split(/\s+/).filter(Boolean)) ledger.add(version);
for (const file of fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
  const version = file.split('_')[0];
  if (ledger.has(version)) continue;
  // Keep a migration's own transaction intact; mark only after strict success.
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
  if (!sql.replace(/--[^\n]*/g, '').trim()) throw new Error(`Refusing empty pending migration ${file}`);
  runSql(sql, file);
  runSql(`INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${version}', '${file.replaceAll("'", "''")}');`, `ledger ${version}`);
}
