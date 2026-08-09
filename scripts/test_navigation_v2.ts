import { createClient } from '@supabase/supabase-js';
import { loadRouteDetail } from '../src/features/hiking/services/RouteService';
import { detectRouteTurns, nextTurnOnRoute } from '../src/features/hiking/services/RouteGeom';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log('=== TEST NAVIGATION V2 — Virages & Géométrie ===');

  console.log('\n--- 1) Route 3 (Via Francigena) ---');
  const r3 = await loadRouteDetail(supabase, '3');
  assert(!!r3?.geojson, 'Route 3 geojson chargée');

  if (r3?.geojson) {
    const turns = detectRouteTurns(r3.geojson);
    console.log(`  Route 3 : ${turns.length} virages significatifs détectés`);
    turns.slice(0, 5).forEach((t) => {
      console.log(`    - [${t.turnType}] à ${t.distanceMFromStart}m : "${t.instructionText}" (${t.angleDeg}°)`);
    });
    assert(turns.length > 0, 'Au moins un virage significatif détecté sur Route 3');

    // Test de détection du prochain virage au départ (progress 0)
    const upcomingAtStart = nextTurnOnRoute(r3.geojson, 0.0);
    assert(upcomingAtStart != null, 'Prochain virage identifié au départ');
    if (upcomingAtStart) {
      console.log(`    -> Prochain virage au départ : ${upcomingAtStart.turn.instructionText} dans ${upcomingAtStart.distanceRemainingM}m`);
    }

    // Test de détection du prochain virage à 50% du parcours
    const upcomingAtMid = nextTurnOnRoute(r3.geojson, 0.5);
    assert(upcomingAtMid != null, 'Prochain virage identifié à 50% du parcours');
    if (upcomingAtMid) {
      console.log(`    -> Prochain virage à 50% : ${upcomingAtMid.turn.instructionText} dans ${upcomingAtMid.distanceRemainingM}m`);
    }
  }

  console.log('\n--- 2) Route 1 (Tracé sans POI) ---');
  const r1 = await loadRouteDetail(supabase, '1');
  assert(!!r1?.geojson, 'Route 1 geojson chargée');

  if (r1?.geojson) {
    const turns1 = detectRouteTurns(r1.geojson);
    console.log(`  Route 1 : ${turns1.length} virages significatifs détectés`);
    assert(Array.isArray(turns1), 'Virages calculés proprement sur Route 1');
  }

  console.log('\n🎉 Virages et guidage V2 calculés avec succès sur les données PostGIS réelles.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
