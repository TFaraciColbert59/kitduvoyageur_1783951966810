/**
 * CHANTIER ATLAS — Phase 1 — Vérification post-cleanup.
 *
 * Prouve que la production de la Phase 1 est intacte après la suppression des
 * fonctions d'observabilité temporaires :
 *   - trails_in_viewport répond (bbox Nord-France, données réelles)
 *   - les matviews de densité répondent
 *   - les fonctions atlas_debug_* ont bien disparu
 *
 * Usage: node scripts/atlas/verify-phase1-cleanup.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[verify] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;

function report(label, ok, detail) {
  console.log(`${ok ? 'OK ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function main() {
  const rpc = await supabase.rpc('trails_in_viewport', {
    p_min_lng: 2.4,
    p_min_lat: 50.7,
    p_max_lng: 2.8,
    p_max_lat: 50.9,
    p_zoom: 13,
    p_simplify_tolerance: 0,
    p_min_dist: 0,
    p_max_dist: null,
    p_difficulty: null,
    p_search: null,
    p_include_short: true,
    p_limit: 5,
  });
  report(
    'trails_in_viewport répond',
    !rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0,
    rpc.error ? rpc.error.message : `${rpc.data?.length} lignes`
  );

  for (const view of ['country_centroids', 'country_trail_density', 'trail_density_geohash5']) {
    const { count, error } = await supabase
      .from(view)
      .select('*', { count: 'exact', head: true });
    report(`matview ${view} lisible`, !error && (count ?? 0) > 0, error ? error.message : `${count} lignes`);
  }

  for (const fn of ['atlas_debug_rls_status', 'atlas_debug_policies', 'atlas_set_country_geometry']) {
    const { error } = await supabase.rpc(fn);
    const notFound =
      error?.code === 'PGRST202' || /could not find the function/i.test(error?.message || '');
    report(`fonction ${fn} supprimée`, notFound, notFound ? 'absente (attendu)' : 'ENCORE PRÉSENTE');
  }

  console.log(failures === 0 ? '\n[verify] SUCCÈS' : `\n[verify] ${failures} ÉCHEC(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('[verify] échec:', error);
  process.exit(1);
});
