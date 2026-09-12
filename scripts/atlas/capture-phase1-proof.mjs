/**
 * CHANTIER ATLAS — Phase 1 — Capture des preuves brutes (ATLAS-R8).
 *
 * Appelle les RPC d'observabilité temporaires (service_role uniquement) :
 *   - atlas_debug_rls_status / atlas_debug_policies : vérité RLS en prod
 *   - atlas_debug_explain : plan EXPLAIN ANALYZE de la RPC trails_in_viewport
 * Puis compte les lignes réelles (hiking_routes, countries_geo, matviews).
 *
 * Usage :
 *   node scripts/atlas/capture-phase1-proof.mjs            # état des lieux
 *   node scripts/atlas/capture-phase1-proof.mjs --refresh  # rafraîchit les matviews avant capture
 *
 * ⚠️ Dépend des fonctions temporaires `atlas_debug_*` créées par
 * supabase/migrations/20260912000000_atlas_debug_observability.sql puis
 * supprimées par 20260912020000_atlas_drop_debug_functions.sql. Pour rejouer
 * cette capture après coup, ré-appliquer d'abord la migration d'observabilité.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[capture] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const args = new Set(process.argv.slice(2));

function section(title) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}

async function countRows(table, applyFilter) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (applyFilter) query = applyFilter(query);
  const { count, error } = await query;
  return error ? `ERROR: ${error.message}` : count;
}

async function main() {
  section(`PROJET : ${url}`);

  if (args.has('--refresh')) {
    const { error } = await supabase.rpc('refresh_atlas_density');
    console.log(`[refresh_atlas_density] ${error ? `ERROR: ${error.message}` : 'OK'}`);
  }

  section('RLS STATUS (relrowsecurity / relforcerowsecurity)');
  {
    const { data, error } = await supabase.rpc('atlas_debug_rls_status');
    console.log(error ? `ERROR: ${error.message}` : JSON.stringify(data, null, 2));
  }

  section('POLICIES (pg_policies)');
  {
    const { data, error } = await supabase.rpc('atlas_debug_policies');
    console.log(error ? `ERROR: ${error.message}` : JSON.stringify(data, null, 2));
  }

  section('EXPLAIN ANALYZE — trails_in_viewport (bbox Chamonix z14)');
  {
    const baseQuery =
      "SELECT r.id, r.name, r.distance_km FROM public.hiking_routes r WHERE r.geom IS NOT NULL AND r.geom && ST_MakeEnvelope(6.82, 45.85, 6.99, 46.03, 4326) AND ST_Intersects(r.geom, ST_MakeEnvelope(6.82, 45.85, 6.99, 46.03, 4326)) ORDER BY r.distance_km DESC NULLS LAST LIMIT 300";
    const rpcQuery =
      "SELECT id, name, start_lat, start_lng, distance_km FROM public.trails_in_viewport(6.82, 45.85, 6.99, 46.03, 14::smallint, 0::double precision)";

    for (const [label, query, disableSeqscan] of [
      ['A. requête de base (plan par défaut)', baseQuery, false],
      ['B. requête de base (enable_seqscan=off -> preuve index GIST)', baseQuery, true],
      ['C. appel RPC (enable_seqscan=off -> preuve inlining + index)', rpcQuery, true],
    ]) {
      console.log(`\n--- ${label} ---`);
      const { data, error } = await supabase.rpc('atlas_debug_explain', {
        p_query: query,
        p_disable_seqscan: disableSeqscan,
      });
      if (error) {
        console.log(`ERROR: ${error.message}`);
      } else {
        for (const row of data || []) {
          console.log(typeof row === 'string' ? row : Object.values(row)[0]);
        }
      }
    }
  }

  section('COMPTES RÉELS');
  console.log(`hiking_routes                      : ${await countRows('hiking_routes')}`);
  console.log(`countries_geo (total)              : ${await countRows('countries_geo')}`);
  console.log(
    `countries_geo (geometry NULL)      : ${await countRows('countries_geo', (q) => q.is('geometry', null))}`
  );
  console.log(`country_centroids                  : ${await countRows('country_centroids')}`);
  console.log(`country_trail_density              : ${await countRows('country_trail_density')}`);
  console.log(`trail_density_geohash5             : ${await countRows('trail_density_geohash5')}`);

  section('ÉCHANTILLONS');
  {
    const { data, error } = await supabase
      .from('country_centroids')
      .select('iso_a2, lat, lng')
      .order('iso_a2')
      .limit(6);
    console.log('country_centroids:', error ? `ERROR: ${error.message}` : JSON.stringify(data));
  }
  {
    const { data, error } = await supabase
      .from('country_trail_density')
      .select('iso_a2, name, trail_count, total_distance_km')
      .order('trail_count', { ascending: false })
      .limit(6);
    console.log('top densités pays:', error ? `ERROR: ${error.message}` : JSON.stringify(data));
  }
  {
    const { data, error } = await supabase.rpc('trails_in_viewport', {
      p_min_lng: 6.82,
      p_min_lat: 45.85,
      p_max_lng: 6.99,
      p_max_lat: 46.03,
      p_zoom: 14,
      p_simplify_tolerance: 0,
      p_min_dist: 2.0,
      p_max_dist: null,
      p_difficulty: null,
      p_search: null,
      p_include_short: false,
      p_limit: 300,
    });
    const rows = data || [];
    console.log(`trails_in_viewport (Chamonix z14)  : ${rows.length} lignes`);
    console.log('3 premières:', JSON.stringify(rows.slice(0, 3), null, 2));
  }

  section('DISTRIBUTION GLOBALE (palier monde)');
  {
    const { data, error } = await supabase
      .from('trail_density_geohash5')
      .select('geohash, trail_count, center_lat, center_lng')
      .order('trail_count', { ascending: false })
      .limit(8);
    console.log('top cellules geohash5:', error ? `ERROR: ${error.message}` : JSON.stringify(data, null, 2));
  }
  {
    const { data, error } = await supabase.rpc('trails_in_viewport', {
      p_min_lng: -180,
      p_min_lat: -85,
      p_max_lng: 180,
      p_max_lat: 85,
      p_zoom: 4,
      p_simplify_tolerance: 0,
      p_min_dist: 0,
      p_max_dist: null,
      p_difficulty: null,
      p_search: null,
      p_include_short: true,
      p_limit: 5,
    });
    const rows = data || [];
    console.log(`trails_in_viewport (monde, limit 5): ${rows.length} lignes`);
    console.log(
      JSON.stringify(
        rows.map((r) => ({ id: r.id, name: r.name, lat: r.start_lat, lng: r.start_lng })),
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error('[capture] échec:', error);
  process.exit(1);
});
