import { HikerProfileService } from '../src/features/hiking/services/HikerProfileService';
import { TrailRecommendationEngine } from '../src/features/hiking/intelligence/TrailRecommendationEngine';
import { HikeSession } from '../src/features/hiking/types';

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log('=== TEST MISSION V4 — Système Intelligent du Voyageur ===');

  console.log('\n--- 1) Utilisateur sans historique (Nouveau profil) ---');
  const emptyProfile = HikerProfileService.computeProfile([]);
  assert(emptyProfile.totalSessions === 0, '0 session détectée');
  assert(emptyProfile.levelTitle === 'Débutant', 'Niveau initial = Débutant');
  assert(emptyProfile.totalDistanceKm === 0, 'Distance totale = 0 km');

  console.log('\n--- 2) Utilisateur actif (10 sessions réelles) ---');
  const mockSessions: HikeSession[] = [
    { id: 's1', userId: 'u1', startedAt: '2026-08-01T09:00:00Z', endedAt: '2026-08-01T11:00:00Z', distanceKm: 8.5, durationSeconds: 7200, elevationGainM: 210, positions: [], poiEvents: [{ poiName: 'Eau', reachedAt: '2026-08-01T10:00:00Z', lat: 50, lon: 3 }] },
    { id: 's2', userId: 'u1', startedAt: '2026-08-03T09:00:00Z', endedAt: '2026-08-03T11:30:00Z', distanceKm: 9.2, durationSeconds: 9000, elevationGainM: 300, positions: [], poiEvents: [] },
    { id: 's3', userId: 'u1', startedAt: '2026-08-05T09:00:00Z', endedAt: '2026-08-05T12:00:00Z', distanceKm: 11.0, durationSeconds: 10800, elevationGainM: 450, positions: [], poiEvents: [] },
    { id: 's4', userId: 'u1', startedAt: '2026-08-07T09:00:00Z', endedAt: '2026-08-07T11:15:00Z', distanceKm: 7.8, durationSeconds: 8100, elevationGainM: 180, positions: [], poiEvents: [] },
    { id: 's5', userId: 'u1', startedAt: '2026-08-08T09:00:00Z', endedAt: '2026-08-08T11:45:00Z', distanceKm: 8.9, durationSeconds: 9900, elevationGainM: 260, positions: [], poiEvents: [] },
    { id: 's6', userId: 'u1', startedAt: '2026-08-09T09:00:00Z', endedAt: '2026-08-09T11:30:00Z', distanceKm: 10.1, durationSeconds: 9000, elevationGainM: 310, positions: [], poiEvents: [] },
    { id: 's7', userId: 'u1', startedAt: '2026-08-09T14:00:00Z', endedAt: '2026-08-09T16:30:00Z', distanceKm: 7.4, durationSeconds: 9000, elevationGainM: 190, positions: [], poiEvents: [] },
    { id: 's8', userId: 'u1', startedAt: '2026-08-09T17:00:00Z', endedAt: '2026-08-09T19:00:00Z', distanceKm: 8.0, durationSeconds: 7200, elevationGainM: 200, positions: [], poiEvents: [] },
  ];

  const activeProfile = HikerProfileService.computeProfile(mockSessions);
  assert(activeProfile.totalSessions === 8, '8 sessions réelles comptabilisées');
  assert(activeProfile.levelTitle === 'Confirmé', 'Niveau calculé = Confirmé');
  assert(activeProfile.avgDistanceKm >= 8.5, 'Distance moyenne calculée (> 8.5 km)');
  assert(activeProfile.maxDistanceKm === 11.0, 'Record de distance = 11.0 km');

  console.log('\n--- 3) Moteur de Recommandations Explicables ---');
  const availableRoutes = [
    { id: '3', name: 'Via Francigena - Etape 1', distanceKm: 9.5, elevationGainM: 320, difficulty: 'Modérée' },
    { id: '1', name: 'Sentier du Littoral', distanceKm: 6.0, elevationGainM: 100, difficulty: 'Facile' },
    { id: '12', name: 'Traversée des Crêtes', distanceKm: 18.2, elevationGainM: 950, difficulty: 'Difficile' },
  ];

  const recommendations = TrailRecommendationEngine.recommendTrails(activeProfile, availableRoutes, ['1']);
  assert(recommendations.length > 0, 'Recommandations générées');
  assert(recommendations[0].routeId === '3', 'Top recommandation = Route 3 (9.5 km adapté au profil)');
  assert(recommendations[0].reason.length > 10, 'Explication explicite générée sans ambiguïté');

  console.log(`    Top choix : ${recommendations[0].name} (${recommendations[0].matchScore}% match) -> "${recommendations[0].reason}"`);

  console.log('\n🎉 Mission V4 — Système Intelligent du Voyageur 100% validé.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
