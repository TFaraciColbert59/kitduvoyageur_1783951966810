// scripts/inspect_hikes.ts
// No dotenv import needed; environment variables are already loaded
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

(async () => {
  // 1️⃣ Total count
  const { count, error: countErr } = await supabase
    .from('explore_trails')
    .select('id', { count: 'exact', head: true });
  if (countErr) throw countErr;
  console.log(`TOTAL RANDONNÉES EN BDD : ${count}`);

  // 2️⃣ Sample columns & types (first 5 rows)
  const { data: sample, error: sampleErr } = await supabase
    .from('map_refuges')
    .select('*')
    .limit(5);
  if (sampleErr) throw sampleErr;
  console.log('--- Sample columns & types (inferred) ---');
  if (sample && sample.length) {
    const keys = Object.keys(sample[0]);
    console.log(keys.join(', '));
  }

  // 3️⃣ Detect duplicate IDs
  const { data: allIds, error: idsErr } = await supabase
    .from('map_refuges')
    .select('id')
    .order('id');
  if (idsErr) throw idsErr;
  const idMap = new Map<string, number>();
  const duplicates: string[] = [];
  allIds?.forEach((row) => {
    const cnt = (idMap.get(row.id) || 0) + 1;
    idMap.set(row.id, cnt);
    if (cnt === 2) duplicates.push(row.id);
  });
  console.log(`Duplicate IDs found: ${duplicates.length}`);
  if (duplicates.length) console.log(duplicates.join(', '));

  // 4️⃣ Geometry presence check
    // 4️⃣ Geometry presence check (optional if geometry column exists)
    let geomRows: any[] = [];
    try {
      const { data, error } = await supabase.from('map_refuges').select('id, geometry').neq('geometry', null);
      if (error) throw error;
      geomRows = data ?? [];
    } catch (e) {
      console.log('Geometry column not found or error – skipping geometry check');
    }
    console.log(`Rows with geometry present: ${geomRows.length}`);

  // 5️⃣ Aggregate stats (if RPC exists)
  const { data: stats, error: statsErr } = await supabase.rpc('stats_summary');
  if (statsErr) {
    console.log('stats_summary RPC not found – skipping aggregate stats');
  } else {
    console.log('Aggregate stats:', stats);
  }
})().catch((e) => {
  console.error('Audit script failed:', e);
  process.exit(1);
});
