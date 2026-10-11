#!/usr/bin/env node
/** Restore the private points snapshot only to the dedicated local test DB. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
const snapshotDir = process.argv[2];
if (!snapshotDir) throw new Error('Private snapshot directory required');
const manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'manifest.json'), 'utf8'));
const db = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'postgres', password: 'lkdv-local-only', database: 'lkdv_restore' });
const q = (name) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Unexpected identifier');
  return `"${name}"`;
};
const report = { capturedAt: new Date().toISOString(), environment: 'localhost:55432/lkdv_restore', tables: [], sourceConsistency: manifest.consistency };
try {
  await db.connect();
  await db.query('BEGIN');
  // Local fixture loading only, never run against the environment Supabase URL.
  await db.query("SET LOCAL session_replication_role='replica'");
  const profiles = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'user_profiles.json'), 'utf8'));
  for (const profile of profiles) {
    await db.query("INSERT INTO auth.users(id,email,aud,role) VALUES ($1,$2,'authenticated','authenticated') ON CONFLICT (id) DO NOTHING", [profile.id, `${profile.id}@restore.invalid`]);
  }
  for (const tableInfo of manifest.tables) {
    const content = fs.readFileSync(path.join(snapshotDir, tableInfo.file));
    if (crypto.createHash('sha256').update(content).digest('hex') !== tableInfo.sha256) throw new Error(`Hash mismatch ${tableInfo.table}`);
    const rows = JSON.parse(content);
    const table = q(tableInfo.table);
    await db.query(`DELETE FROM public.${table}`);
    for (const original of rows) {
      const row = { ...original };
      if (tableInfo.table === 'user_profiles') row.email = `${row.id}@restore.invalid`;
      const cols = Object.keys(row);
      // JSON arrays must use the PostgreSQL column type's input conversion.
      await db.query(`INSERT INTO public.${table} (${cols.map(q).join(',')}) SELECT ${cols.map(q).join(',')} FROM jsonb_populate_record(NULL::public.${table}, $1::jsonb)`, [JSON.stringify(row)]);
    }
    const cols = tableInfo.columns === '*' ? null : tableInfo.columns.split(',');
    const projection = cols ? cols.map(c => `r.${q(c)}`).join(',') : 'r.*';
    const comparison = await db.query(`WITH expected AS (
      SELECT to_jsonb(t) AS row FROM (SELECT ${projection} FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb) r) t
    ), actual AS (
      SELECT to_jsonb(t) AS row FROM (SELECT ${projection} FROM public.${table} r) t
    ) SELECT (SELECT count(*)::int FROM actual) AS restored_count,
      (SELECT count(*)::int FROM ((SELECT row FROM expected EXCEPT ALL SELECT row FROM actual)
       UNION ALL (SELECT row FROM actual EXCEPT ALL SELECT row FROM expected)) differences) AS differences`, [JSON.stringify(rows)]);
    const result = comparison.rows[0];
    report.tables.push({ table: tableInfo.table, expectedCount: tableInfo.rowCount, restoredCount: result.restored_count, differences: result.differences });
    if (result.restored_count !== tableInfo.rowCount || result.differences !== 0) throw new Error(`Comparison mismatch ${tableInfo.table}`);
  }
  await db.query('COMMIT');
  report.ok = true;
} catch (error) {
  await db.query('ROLLBACK').catch(() => {});
  report.ok = false;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
  fs.writeFileSync(path.join(snapshotDir, 'restore-evidence.json'), JSON.stringify(report, null, 2)+'\n', { mode: 0o600 });
  console.log(JSON.stringify({ ok: report.ok, checkedTables: report.tables.length, error: report.error ?? null }));
}
