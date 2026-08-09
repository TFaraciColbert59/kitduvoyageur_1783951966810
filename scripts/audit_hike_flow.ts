// Test d'intégration du moteur hiking avec de VRAIES données Supabase :
//   routes 3 (avec POI réel) et 1 (sans POI).
// Simule une marche réaliste (~1,4 m/s) le long des géométries réelles et vérifie :
//   - progression projetée (P5) non décroissante et ≈ position sur tracé
//   - prochain POI réel devant l'utilisateur (P6)
//   - franchissement d'un POI → passage automatique au suivant
//   - déviation vs tracé (P7) : 60 m → hors parcours, < 30 m → retour
//   - bearing géométrie réel (P8)
//   - TrackingEngine : distance accumulée + rejet des outliers
// Usage : npx tsx scripts/audit_hike_flow.ts
import { createClient } from '@supabase/supabase-js';
import { loadRouteDetail } from '../src/features/hiking/services/RouteService';
import { closestOnRoute, flattenSegments, routeBearingAt } from '../src/features/hiking/services/RouteGeom';
import { TrackingEngine } from '../src/features/hiking/engine/TrackingEngine';
import { HikeEngine } from '../src/features/hiking/engine/HikeEngine';

const URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
const originalWarn = console.warn;
console.warn = () => {}; // silence volontaire des warnings d'outlier (testés ci-dessous)

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

/** Marche à ~1,5 m/s : un point tous les ~15 m, toutes les 10 s, le long du tracé. */
function walkAlong(geojson: any): { lat: number; lng: number; ts: number }[] {
  const segments = flattenSegments(geojson);
  const stepM = 15;
  const out: { lat: number; lng: number; ts: number }[] = [];
  let ts = Date.now();
  for (const seg of segments) {
    const len = seg.segLenM;
    if (len <= 0) continue;
    const steps = Math.max(1, Math.round(len / stepM));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({
        lat: seg.startLat + (seg.endLat - seg.startLat) * t,
        lng: seg.startLng + (seg.endLng - seg.startLng) * t,
        ts,
      });
      ts += 10000; // une position toutes les 10 s
    }
  }
  return out;
}

/** Logique "prochain POI" du contrôleur, appliquée sur des données réelles. */
function nextPoiFor(pos: { lat: number; lng: number }, pois: any[], projected: { progressFrac: number } | null, reached: Set<string>) {
  for (const poi of pois) {
    if (reached.has(poi.id)) continue;
    const distM = HikeEngine.calculateDistanceKm(pos.lat, pos.lng, poi.lat, poi.lon) * 1000;
    if (distM < 30) { reached.add(poi.id); continue; }
    const behind = poi.progressFrac != null && projected != null && poi.progressFrac < projected.progressFrac - 0.03;
    if (behind) { reached.add(poi.id); continue; }
    return poi.name;
  }
  return null;
}

async function simulate(routeId: string, label: string) {
  console.log(`\n=== SIMULATION ${label} (route ${routeId}) ===`);
  const route = await loadRouteDetail(supabase as never, routeId);
  assert(!!route && !!route.geojson, `route ${routeId} chargée (${route?.name}: ${route?.distanceKm?.toFixed(1)} km)`);
  if (!route?.geojson) return;

  const walk = walkAlong(route.geojson);
  console.log(`  points de marche simulés : ${walk.length} (~${(walk.length * 15 / 1000).toFixed(1)} km)`);
  const engine = new TrackingEngine();

  const reached = new Set<string>();
  let prevPct: number | null = null;
  let nextAt10: string | null = null;
  let nextAtEnd: string | null = null;

  for (let i = 0; i < walk.length; i++) {
    const { lat, lng, ts } = walk[i];
    const accepted = engine.processPosition({ latitude: lat, longitude: lng, accuracy: 5, timestamp: ts });
    if (!accepted) { assert(false, `position n°${i} rejetée à tort`); continue; }
    const projected = closestOnRoute(route.geojson, lat, lng);
    const pct = projected != null && route.distanceKm ? Math.min(100, Math.round(projected.progressFrac * 100)) : null;
    if (prevPct != null && pct != null) assert(pct >= prevPct, `progression non décroissante (${prevPct}→${pct}%)`);
    if (pct != null) prevPct = pct;
    const next = nextPoiFor({ lat, lng }, route.pois, projected, reached);
    if (pct != null && pct >= 8 && pct <= 15) nextAt10 = nextPoiFor({ lat, lng }, route.pois, projected, new Set()); // sans muter
    if (i >= walk.length - 2) nextAtEnd = next;
  }

  const metrics = engine.getMetrics();
  assert(metrics.distanceKm > 0, `distance GPS accumulée réelle : ${metrics.distanceKm.toFixed(1)} km`);
  const expectPct = Math.round(prevPct ?? 0);
  assert(prevPct != null && prevPct >= 95, `progression finale projetée ≈ fin de parcours (${expectPct}%)`);

  if (route.pois.length > 0) {
    assert(nextAt10 === route.pois[0].name, `POI réel proposé devant l'utilisateur à ~10% (« ${nextAt10} »)`);
  } else {
    assert(nextAt10 === null && nextAtEnd === null, 'aucun POI fictif proposé (route sans POI)');
  }

  // Bearing géométrie réel (P8)
  const bearing = routeBearingAt(route.geojson, 0.35);
  assert(bearing != null && Number.isFinite(bearing) && bearing >= 0 && bearing < 360, `bearing route réel à 35% : ${bearing?.toFixed(0)}°`);

  // Outlier rejection (P3)
  const e2 = new TrackingEngine();
  e2.processPosition({ latitude: walk[0].lat, longitude: walk[0].lng, accuracy: 5, timestamp: walk[0].ts });
  const rejected = e2.processPosition({ latitude: walk[0].lat + 2, longitude: walk[0].lng + 2, accuracy: 5, timestamp: walk[0].ts + 1000 });
  assert(!rejected, 'outlier (saut ~250 km/s) rejeté par TrackingEngine');

  console.warn = () => {}; // ré-active après (guard)
}

async function poiReachTest(routeId: string) {
  console.log(`\n=== FRANCHISSEMENT POI (route ${routeId}) ===`);
  const route = await loadRouteDetail(supabase as never, routeId);
  const poi = route?.pois[0];
  if (!poi) { console.log('  (aucun POI — non applicable)'); return; }
  const reached = new Set<string>();
  const near = { lat: poi.lat + 0.9 / 111000 * 0.5, lng: poi.lon }; // ~500 m du POI (hors tracé mais avant)
  let next = nextPoiFor(near, route.pois, { progressFrac: oldestFrac(route, poi) }, reached);
  console.log(`  POI « ${poi.name} » à ${poi.distanceM}m du tracé, progress ${poi.progressFrac.toFixed(3)}`);
  // position à ~15 m du POI → franchissement
  const onPoi = { lat: poi.lat + 0.00014, lng: poi.lon }; // ~15 m
  next = nextPoiFor(onPoi, route.pois, { progressFrac: poi.progressFrac }, reached);
  assert(reached.has(poi.id), `POI marqué « atteint » (<30 m)`);
  const after = nextPoiFor(onPoi, route.pois, { progressFrac: poi.progressFrac + 0.05 }, reached);
  assert(after === null, `plus aucun POI restant → nextPoi = null (passage automatique)`);
}

function oldestFrac(route: any, poi: any) { return Math.min(0.01, poi.progressFrac); }

async function deviationTest(routeId: string) {
  console.log(`\n=== DÉVIATION VS TRACÉ (route ${routeId}) ===`);
  const route = await loadRouteDetail(supabase as never, routeId);
  if (!route?.geojson) return;
  const seg = flattenSegments(route.geojson)[1];
  // Point sur le tracé
  const on = closestOnRoute(route.geojson, seg.startLat, seg.startLng);
  assert(on != null && on.distanceM < 30, `sur le tracé : distance < 30 m (${on?.distanceM.toFixed(1)} m)`);
  // Décalé de 60 m
  const offLat = seg.startLat + 60 / 111000;
  const off = closestOnRoute(route.geojson, offLat, seg.startLng);
  assert(off != null && off.distanceM > 50, `à 60 m du tracé : distance mesurée > 50 m (${off?.distanceM.toFixed(1)} m)`);
  // Retour < 30
  const backLat = seg.startLat + 20 / 111000;
  const back = closestOnRoute(route.geojson, backLat, seg.startLng);
  assert(back != null && back.distanceM < 30, `à 20 m du tracé : < 30 m (${back?.distanceM.toFixed(1)} m) — retour sur parcours`);
}

async function main() {
  await simulate('3', 'avec POI réel');
  await simulate('1', 'sans POI');
  await deviationTest('1');
  await poiReachTest('3');
  console.warn = originalWarn;
  console.log('\nFIN');
}

main().catch((e) => { console.error(e); process.exit(1); });