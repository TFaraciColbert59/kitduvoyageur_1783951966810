// Vérification locale des migrations LKDV Control (Postgres éphémère /tmp/pgtest, port 55432).
// Aucun accès réseau, aucune production. Applique les fichiers 20261109* dans l'ordre,
// s'arrête au premier échec et imprime le contexte SQL.
import pg from './pg.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../../../', import.meta.url).pathname;
const only = process.argv[2];
const limit = process.argv[3];

const files = readdirSync(path.join(ROOT, 'supabase/migrations'))
  .filter((f) => f.startsWith('20261109') && f.endsWith('.sql'))
  .sort();

const c = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'postgres', password: 'postgres', database: 'lkdv_shim' });
await c.connect();

for (const f of files) {
  if (only && !f.includes(only)) continue;
  if (limit && f > `20261109${limit}`) continue;
  const sql = readFileSync(path.join(ROOT, 'supabase/migrations', f), 'utf8');
  try {
    await c.query('begin');
    await c.query(sql);
    await c.query('commit');
    console.log('OK   ', f);
  } catch (e) {
    await c.query('rollback').catch(() => {});
    console.log('FAIL ', f, '\n  ', e.message);
    const pos = Number(e.position);
    if (pos) {
      const line = sql.slice(0, pos).split('\n').length;
      console.log('   ligne ~', line);
      console.log('   contexte:', sql.slice(Math.max(0, pos - 400), pos + 200));
    }
    process.exit(1);
  }
}
await c.end();
