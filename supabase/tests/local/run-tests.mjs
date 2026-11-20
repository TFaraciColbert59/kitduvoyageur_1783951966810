import pg from './pg.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const ROOT = new URL('../../../', import.meta.url).pathname;
const c = new pg.Client({ host:'127.0.0.1', port:55432, user:'postgres', password:'postgres', database:'lkdv_shim' });
await c.connect();
await c.query(readFileSync('supabase/tests/local/pgtap_stub.sql','utf8'));
const files = readdirSync(path.join(ROOT,'supabase/tests/database')).filter(f=>f.startsWith('crm_')&&f.endsWith('.sql')).sort();
let ko=0;
for (const f of files) {
  const sql = readFileSync(path.join(ROOT,'supabase/tests/database',f),'utf8');
  try { await c.query('begin'); await c.query(sql); await c.query('rollback'); console.log('TEST OK  ', f); }
  catch(e){ await c.query('rollback').catch(()=>{}); ko++;
    console.log('TEST FAIL', f, '\n   ', e.message);
    const pos=Number(e.position); if(pos) console.log('   ligne ~', sql.slice(0,pos).split('\n').length);
  }
}
console.log(`\n${files.length-ko}/${files.length} fichiers de test verts`);
await c.end();
process.exit(ko?1:0);
