import pg from './pg.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const ROOT = new URL('../../../', import.meta.url).pathname;
const c = new pg.Client({ host:'127.0.0.1', port:55432, user:'postgres', password:'postgres', database:'lkdv_shim' });
await c.connect();
const ups = readdirSync(path.join(ROOT,'supabase/migrations')).filter(f=>f.startsWith('20261109')&&f.endsWith('.sql')).sort();
const downs = readdirSync(path.join(ROOT,'supabase/migrations_down')).filter(f=>f.startsWith('20261109')&&f.endsWith('.down.sql')).sort().reverse();
let n=0;
for (const f of downs) {
  const sql = readFileSync(path.join(ROOT,'supabase/migrations_down',f),'utf8');
  try { await c.query('begin'); await c.query(sql); await c.query('commit'); console.log('DOWN OK  ', f); n++; }
  catch(e){ await c.query('rollback').catch(()=>{}); console.log('DOWN FAIL', f, '\n  ', e.message);
    const pos=Number(e.position); if(pos) console.log('  ligne ~', sql.slice(0,pos).split('\n').length, '\n  ctx:', sql.slice(Math.max(0,pos-300), pos+150));
    process.exit(1); }
}
console.log(`\n${n}/${downs.length} rollbacks passés`);
// Réapplication des up après rollback (idempotence)
let m=0;
for (const f of ups) {
  const sql = readFileSync(path.join(ROOT,'supabase/migrations',f),'utf8');
  try { await c.query('begin'); await c.query(sql); await c.query('commit'); m++; }
  catch(e){ await c.query('rollback').catch(()=>{}); console.log('REAPPLY FAIL', f, '\n  ', e.message); process.exit(1); }
}
console.log(`${m}/${ups.length} migrations réappliquées après rollback`);
await c.end();
