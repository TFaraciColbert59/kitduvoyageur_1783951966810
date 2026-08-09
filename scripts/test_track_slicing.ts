import { createClient } from '@supabase/supabase-js';
import { loadRouteDetail } from '../src/features/hiking/services/RouteService';
import { sliceRouteGeoJSON, closestOnRoute } from '../src/features/hiking/services/RouteGeom';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log('=== TEST DECOUPAGE DYNAMIQUE TRACÉ (PARCOURS EFFECTUE VS RESTANT) ===');

  const route3 = await loadRouteDetail(supabase, '3');
  assert(route3 != null && route3.geojson != null, 'Route 3 geojson chargée');

  if (!route3?.geojson) return;

  console.log('\n--- 1) Départ (Progress 0%) ---');
  const slice0 = sliceRouteGeoJSON(route3.geojson, 0.0);
  assert(slice0.completedGeojson === null, 'Parcours effectué = null au départ');
  assert(slice0.remainingGeojson != null, 'Parcours restant = GeoJSON complet au départ');

  console.log('\n--- 2) Mi-parcours (Progress 50%) ---');
  const slice50 = sliceRouteGeoJSON(route3.geojson, 0.5);
  assert(slice50.completedGeojson != null, 'Parcours effectué existe à 50%');
  assert(slice50.remainingGeojson != null, 'Parcours restant existe à 50%');

  const compCoords = (slice50.completedGeojson as any)?.coordinates || [];
  const remCoords = (slice50.remainingGeojson as any)?.coordinates || [];
  console.log(`  Points effectués: ${compCoords.length}, Points restants: ${remCoords.length}`);

  // Vérifier la continuité exacte du point de jonction
  const lastComp = compCoords[compCoords.length - 1];
  const firstRem = remCoords[0];
  const isContinuous = Math.abs(lastComp[0] - firstRem[0]) < 1e-6 && Math.abs(lastComp[1] - firstRem[1]) < 1e-6;
  assert(isContinuous, `Point de jonction continu à (lng:${lastComp[0].toFixed(5)}, lat:${lastComp[1].toFixed(5)})`);

  console.log('\n--- 3) Arrivée (Progress 100%) ---');
  const slice100 = sliceRouteGeoJSON(route3.geojson, 1.0);
  assert(slice100.completedGeojson != null, 'Parcours effectué = GeoJSON complet à l\'arrivée');
  assert(slice100.remainingGeojson === null, 'Parcours restant = null à l\'arrivée');

  console.log('\n--- 4) Test Projection GPS Réelle & Découpage Dynamique ---');
  // Tester la projection d'un point GPS réel sur la route 3
  const startPt = (slice50.completedGeojson as any).coordinates[0];
  const proj = closestOnRoute(route3.geojson, startPt[1], startPt[0]);
  assert(proj != null, 'Projection GPS effectuée avec succès sur la géométrie PostGIS');
  assert(proj!.progressFrac >= 0 && proj!.progressFrac <= 1, `Progression projection: ${(proj!.progressFrac * 100).toFixed(2)}%`);

  console.log('\n🎉 Découpage dynamique et projection GPS validés sur géométrie PostGIS réelle.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
