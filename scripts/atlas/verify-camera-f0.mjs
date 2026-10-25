/**
 * FLUIDITÉ — F0 : vérifications empiriques avant tout réglage caméra.
 *
 * 1. `raster-fade-duration` sur maplibre-gl@6.4.1 : valeur par défaut observée,
 *    puis application explicite et vérification qu'elle tient après changement
 *    de fond de carte (le bug historique 4.3.0→5.0.0-pre6 ignorait la propriété).
 * 2. Mesure réelle des trajets pays (proche / lointain / antipodal) : distance
 *    haversine + Δzoom, pour calibrer `curve`/`speed` (FLU-R1) au lieu de deviner.
 *
 * Usage : node scripts/atlas/verify-camera-f0.mjs
 * (serveur dev requis sur :4000 ; centroïdes lus depuis la matview country_centroids)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('[f0] env Supabase manquantes');
  process.exit(1);
}

const EARTH_RADIUS_KM = 6371;
function toRad(value) {
  return (value * Math.PI) / 180;
}
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: centroids, error } = await supabase
  .from('country_centroids')
  .select('iso_a2, lat, lng')
  .in('iso_a2', ['FR', 'DE', 'NP', 'NZ']);
if (error) {
  console.error('[f0] lecture country_centroids:', error.message);
  process.exit(1);
}
const byIso = Object.fromEntries((centroids ?? []).map((row) => [row.iso_a2, row]));

console.log('=== F0.2 — MESURE DES TRAJETS PAYS (centroïdes réels) ===');
console.log('trajet | distance km | Δzoom (5→4.6 simulé z5) | durée fixe actuelle | vitesse implicite');
for (const [from, to] of [
  ['FR', 'DE'],
  ['FR', 'NP'],
  ['FR', 'NZ'],
]) {
  const a = byIso[from];
  const b = byIso[to];
  if (!a || !b) {
    console.log(`${from}→${to} | centroïde manquant`);
    continue;
  }
  const km = haversineKm(a, b);
  const speed = km / 0.9; // durée fixe actuelle 900 ms
  console.log(
    `${from}→${to} | ${km.toFixed(0)} | 0.4 | 900 ms | ${speed.toFixed(0)} km/s`
  );
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto('http://localhost:4000/explorer?atlas=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="unified-explorer-map"][data-atlas-ready="true"]', {
  timeout: 60_000,
});

console.log('\n=== F0.1 — raster-fade-duration (maplibre-gl@6.4.1) ===');
const rasterProbe = await page.evaluate(async () => {
  const map = window.__atlasTestMap;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const before = map.getPaintProperty('atlas-tile-topo', 'raster-fade-duration') ?? '(défaut implicite)';
  map.setPaintProperty('atlas-tile-topo', 'raster-fade-duration', 1000);
  const afterSet = map.getPaintProperty('atlas-tile-topo', 'raster-fade-duration');
  // Changement de fond de carte puis retour : la propriété doit tenir.
  map.setLayoutProperty('atlas-tile-topo', 'visibility', 'none');
  map.setLayoutProperty('atlas-tile-osm', 'visibility', 'visible');
  await wait(500);
  map.setLayoutProperty('atlas-tile-osm', 'visibility', 'none');
  map.setLayoutProperty('atlas-tile-topo', 'visibility', 'visible');
  await wait(800);
  const afterSwitch = map.getPaintProperty('atlas-tile-topo', 'raster-fade-duration');
  return { before, afterSet, afterSwitch };
});
console.log(JSON.stringify(rasterProbe, null, 2));
console.log('pageErrors:', JSON.stringify(errors));

await browser.close();
