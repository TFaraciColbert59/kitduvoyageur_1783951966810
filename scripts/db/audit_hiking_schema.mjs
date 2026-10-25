// Audit de la BDD randonnée réelle (phase 1) — lecture seule
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_URL est requis'); })();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY est requis'); })();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectTable(name, limit = 2, selectCols = '*') {
  try {
    const { data, error, count } = await supabase
      .from(name)
      .select(selectCols === '*' ? 'count' : selectCols, { count: 'exact', head: true });
    if (error) {
      console.log(`\n❌ ${name}: ${error.code} ${error.message}`);
      return;
    }
    console.log(`\n=== ${name} (${count} rows) ===`);

    const q = await supabase.from(name).select(selectCols).limit(limit);
    if (q.error) {
      console.log(`  select err: ${q.error.code} ${q.error.message}`);
      return;
    }
    if (!q.data || q.data.length === 0) {
      console.log('  (aucune ligne)');
      return;
    }
    // Colonnes (du premier objet)
    const cols = Object.keys(q.data[0]);
    console.log(`  colonnes: ${cols.join(', ')}`);
    q.data.forEach((row, i) => {
      console.log(`  --- ligne ${i} ---`);
      for (const c of cols) {
        let v = row[c];
        if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
        if (typeof v === 'string' && v.length > 160) v = v.slice(0, 160) + '…(' + v.length + 'c)';
        console.log(`    ${c} = ${v}`);
      }
    });
  } catch (e) {
    console.log(`\n❌ ${name}: exception ${e.message}`);
  }
}

async function main() {
  await inspectTable('hiking_routes', 2);
  await inspectTable('trail_metadata', 2);
  await inspectTable('trail_scores', 2);
  await inspectTable('trail_pois', 3);
  await inspectTable('trail_segments', 1);
  await inspectTable('hike_sessions', 1);
  await inspectTable('explore_trails', 3);
}

main();