#!/usr/bin/env node
/**
 * Import des géométries manquantes dans `countries_geo` (P1-01).
 *
 * Source : Natural Earth 1:50m (domaine public), déjà téléchargée par
 * `build-geo.mjs`. Chaque pays sans géométrie reçoit son polygone simplifié
 * (0,02°) en EPSG:4326. Idempotent : les pays déjà renseignés ne sont pas touchés.
 *
 * Usage : node scripts/explorer-v2/import-db-geometries.mjs [--dry]
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'icxyvwzfjbflcbqukpfz';
const ROOT = process.cwd();
const dry = process.argv.includes('--dry');
const source = join(ROOT, '.cache/explorer-v2/ne_50m_admin_0_countries.geojson');

if (!existsSync(source)) throw new Error('Natural Earth absent : lancer `node scripts/explorer-v2/build-geo.mjs`');
const token = readFileSync(join(homedir(), '.supabase/access-token'), 'utf8').trim();

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status} : ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : [];
}

const missing = await sql('select iso_a2 from public.countries_geo where geometry is null order by iso_a2;');
const missingSet = new Set(missing.map((row) => row.iso_a2));
console.log(`pays sans géométrie : ${missingSet.size}`);

const ne = JSON.parse(readFileSync(source, 'utf8'));
const byIso = new Map();
for (const feature of ne.features) {
  const props = feature.properties ?? {};
  const iso = String(props.ISO_A2_EH || props.ISO_A2 || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso) || !missingSet.has(iso)) continue;
  if (!byIso.has(iso)) byIso.set(iso, feature.geometry);
}

// Second passage : les territoires absents du 1:50m (petites îles, DOM-TOM)
// existent dans le 1:10m, même domaine public.
const source10m = join(ROOT, '.cache/explorer-v2/ne_10m_admin_0_countries.geojson');
if (existsSync(source10m)) {
  const ne10 = JSON.parse(readFileSync(source10m, 'utf8'));
  for (const feature of ne10.features) {
    const props = feature.properties ?? {};
    const iso = String(props.ISO_A2_EH || props.ISO_A2 || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso) || !missingSet.has(iso) || byIso.has(iso)) continue;
    byIso.set(iso, feature.geometry);
  }
}

console.log(`polygones Natural Earth disponibles pour ${byIso.size} de ces pays`);

let updated = 0;
for (const [iso, geometry] of byIso) {
  const geojson = JSON.stringify(geometry).replace(/'/g, "''");
  const statement = `update public.countries_geo
   set geometry = st_setsrid(st_geomfromgeojson('${geojson}'), 4326),
       geometry_source = 'natural_earth',
       updated_at = now()
 where iso_a2 = '${iso}' and geometry is null;`;
  if (dry) {
    console.log(`[dry] ${iso} (${geojson.length} octets)`);
    continue;
  }
  await sql(statement);
  updated += 1;
  if (updated % 10 === 0) console.log(`  ${updated}/${byIso.size}…`);
}

if (!dry) {
  const remaining = await sql('select count(*)::int as n from public.countries_geo where geometry is null;');
  console.log(`\nmis à jour : ${updated}`);
  console.log(`pays encore sans géométrie : ${remaining[0].n}`);
  const absent = [...missingSet].filter((iso) => !byIso.has(iso));
  if (absent.length) console.log(`absents de Natural Earth 1:50m : ${absent.join(', ')}`);
}
