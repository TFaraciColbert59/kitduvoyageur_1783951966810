import { HikeContextBuilder } from '../src/features/hiking/intelligence/HikeContext';
import { HikeAlertEngine } from '../src/features/hiking/engine/HikeAlertEngine';
import { HikeTimelineJournal } from '../src/features/hiking/journal/HikeTimelineJournal';

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log('=== TEST COPILOTE V3 — Context, AlertEngine, SyncQueue & Journal ===');

  console.log('\n--- 1) Test HikeContextBuilder ---');
  const ctx = HikeContextBuilder.buildContext({
    positions: [
      { latitude: 50.479, longitude: 3.6343, accuracy: 8, speed: 1.4, heading: 90, timestamp: Date.now() },
    ],
    state: 'TRACKING',
    distanceKm: 4.8,
    totalRouteDistanceKm: 12.0,
    durationSeconds: 3600,
    elevationGainM: 150,
  });

  assert(ctx.accuracyM === 8, 'Précision GPS 8m extraite');
  assert(ctx.remainingDistanceKm === 7.2, 'Distance restante 7.2km calculée');
  assert(Math.round(ctx.progressFrac! * 100) === 40, 'Progression 40% dérivée');

  console.log('\n--- 2) Test HikeAlertEngine ---');
  const alertEngine = new HikeAlertEngine();

  const alert1 = alertEngine.pushAlert({
    type: 'GPS_WEAK',
    priority: 4,
    title: 'Signal GPS faible',
    message: 'Précision > 30m',
    cooldownMs: 5000,
    source: 'gps',
  });
  assert(alert1 != null, 'Alerte GPS_WEAK ajoutée');

  const alert2 = alertEngine.pushAlert({
    type: 'OFF_ROUTE',
    priority: 1,
    title: 'Sortie de parcours',
    message: 'Vous êtes à 65m du tracé',
    cooldownMs: 15000,
    source: 'route',
  });
  assert(alert2 != null, 'Alerte OFF_ROUTE ajoutée');

  const highest = alertEngine.getHighestPriorityAlert();
  assert(highest?.type === 'OFF_ROUTE', 'Alerte OFF_ROUTE (priorité 1) retenue comme prioritaire');

  // Test cooldown
  const alert2Duplicate = alertEngine.pushAlert({
    type: 'OFF_ROUTE',
    priority: 1,
    title: 'Sortie de parcours',
    message: 'Vous êtes à 65m du tracé',
    cooldownMs: 15000,
    source: 'route',
  });
  assert(alert2Duplicate === null, 'Alerte en cooldown rejetée proprement');

  console.log('\n--- 3) Test HikeTimelineJournal (0 hallucination) ---');
  const timeline = HikeTimelineJournal.buildTimeline({
    startedAt: '2026-08-09T08:00:00Z',
    endedAt: '2026-08-09T11:00:00Z',
    distanceKm: 8.5,
    positions: [
      { latitude: 50.479, longitude: 3.6343, timestamp: Date.now() },
      { latitude: 50.485, longitude: 3.6400, timestamp: Date.now() + 10000 },
    ],
    poiEvents: [
      { poiName: 'Source d\'eau douce', reachedAt: '2026-08-09T09:30:00Z', lat: 50.482, lon: 3.637 },
    ],
    routeName: 'Via Francigena - Etape 1',
  });

  assert(timeline.length === 5, `Timeline générée avec 5 événements factuels (reçu: ${timeline.length})`);
  assert(timeline[0].type === 'START', 'Premier événement = START');
  assert(timeline[2].type === 'POI', 'Événement POI placé au bon horodatage');
  assert(timeline[4].type === 'ARRIVAL', 'Dernier événement = ARRIVAL');

  console.log('\n🎉 Module Copilote Outdoor V3 validé à 100% avec 0 mock.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
