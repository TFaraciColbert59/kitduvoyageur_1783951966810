/**
 * CHANTIER ATLAS — Phase 1 — Import des polygones pays depuis le GeoJSON statique.
 *
 * Source : public/data/countries-110m.geojson (fichier réel utilisé par le globe actuel).
 * Cible  : public.countries_geo.geometry (actuellement NULL pour les 195 pays) via la RPC
 *          temporaire atlas_set_country_geometry (service_role uniquement, n'écrase jamais
 *          une géométrie existante).
 *
 * ATLAS-R9 : aucun fallback inventé — chaque feature non appariée est listée telle quelle.
 *
 * Usage :
 *   node scripts/atlas/import_country_polygons.mjs --dry-run   # ne rien écrire
 *   node scripts/atlas/import_country_polygons.mjs             # import réel + refresh matviews
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const GEOJSON_PATH = 'public/data/countries-110m.geojson';
const DRY_RUN = process.argv.includes('--dry-run');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[import] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Portage fidèle de resolveIsoA2 (CountryGlobe.tsx:20-27). */
function resolveIsoA2(props) {
  if (!props) return null;
  const candidates = [props.ISO_A2, props.ISO_A2_EH, props.WB_A2, props.ADM0_A3];
  for (const c of candidates) {
    if (c && c !== '-99' && c !== '-3' && c !== '' && String(c).length === 2) {
      return String(c).toUpperCase();
    }
  }
  return null;
}

function resolveIsoA3(props) {
  if (!props) return null;
  const c = props.ADM0_A3;
  if (c && c !== '-99' && c !== '-3' && c !== '' && String(c).length === 3) {
    return String(c).toUpperCase();
  }
  return null;
}

async function main() {
  console.log(`[import] source: ${GEOJSON_PATH}${DRY_RUN ? ' (DRY RUN)' : ''}`);

  const geojson = JSON.parse(readFileSync(GEOJSON_PATH, 'utf8'));
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  console.log(`[import] features GeoJSON: ${features.length}`);

  const byA2 = new Map();
  const byA3 = new Map();
  for (const feature of features) {
    const props = feature.properties || {};
    const a2 = resolveIsoA2(props);
    const a3 = resolveIsoA3(props);
    if (a2 && !byA2.has(a2)) byA2.set(a2, feature);
    if (a3 && !byA3.has(a3)) byA3.set(a3, feature);
  }
  console.log(`[import] features indexées: A2=${byA2.size}, A3=${byA3.size}`);

  const { data: targets, error } = await supabase
    .from('countries_geo')
    .select('id, iso_a2, iso_a3, name')
    .is('geometry', null)
    .order('iso_a2');

  if (error) {
    console.error('[import] lecture countries_geo échouée:', error.message);
    process.exit(1);
  }

  console.log(`[import] cibles (geometry NULL): ${targets.length} / ${await totalCountries()}`);

  const matched = [];
  const unmatched = [];
  const skippedNoGeometry = [];
  let updated = 0;
  const updateErrors = [];

  for (const target of targets) {
    const a2 = (target.iso_a2 || '').toUpperCase();
    const a3 = (target.iso_a3 || '').toUpperCase();
    const feature = byA2.get(a2) || (a3 ? byA3.get(a3) : null);

    if (!feature) {
      unmatched.push(`${target.iso_a2} — ${target.name}`);
      continue;
    }
    if (!feature.geometry) {
      skippedNoGeometry.push(`${target.iso_a2} — ${target.name}`);
      continue;
    }

    matched.push(`${target.iso_a2} — ${target.name}`);

    if (DRY_RUN) continue;

    const { data, error: rpcError } = await supabase.rpc('atlas_set_country_geometry', {
      p_iso_a2: target.iso_a2,
      p_geojson: feature.geometry,
    });

    if (rpcError) {
      updateErrors.push(`${target.iso_a2}: ${rpcError.message}`);
    } else if (Number(data) > 0) {
      updated += 1;
    }
  }

  console.log(`\n[import] appariées  : ${matched.length}`);
  console.log(`[import] mises à jour: ${updated}`);
  if (unmatched.length) {
    console.log(`[import] NON APPARIÉES (${unmatched.length}):`);
    for (const line of unmatched) console.log(`  - ${line}`);
  }
  if (skippedNoGeometry.length) {
    console.log(`[import] feature sans géométrie (${skippedNoGeometry.length}):`);
    for (const line of skippedNoGeometry) console.log(`  - ${line}`);
  }
  if (updateErrors.length) {
    console.log(`[import] ERREURS RPC (${updateErrors.length}):`);
    for (const line of updateErrors) console.log(`  - ${line}`);
  }

  if (DRY_RUN) {
    console.log('\n[import] DRY RUN terminé — aucune écriture.');
    return;
  }

  console.log('\n[import] refresh_atlas_density()...');
  const { error: refreshError } = await supabase.rpc('refresh_atlas_density');
  console.log(refreshError ? `[import] refresh ERROR: ${refreshError.message}` : '[import] refresh OK');

  const remaining = await countWhereGeometryNull();
  console.log(`[import] countries_geo restant sans géométrie: ${remaining}`);
}

async function totalCountries() {
  const { count, error } = await supabase
    .from('countries_geo')
    .select('*', { count: 'exact', head: true });
  return error ? `ERROR: ${error.message}` : count;
}

async function countWhereGeometryNull() {
  const { count, error } = await supabase
    .from('countries_geo')
    .select('*', { count: 'exact', head: true })
    .is('geometry', null);
  return error ? `ERROR: ${error.message}` : count;
}

main().catch((error) => {
  console.error('[import] échec:', error);
  process.exit(1);
});
