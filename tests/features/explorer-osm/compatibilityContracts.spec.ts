import { describe, it, expect } from 'vitest';
import {
  buildCompasPayload,
  computeUserOutdoorStats,
  createCommunityPost,
  type HikeSessionRecord,
} from '@/features/explorer-osm/services/compatibilityContracts';
import { toRouteId, type RouteId, type HikeSessionId } from '@/features/explorer-osm/domain/types';

describe('Compatibility Contracts — Démonstration de Réutilisation Multi-Domaines', () => {
  const canonicalRouteId = toRouteId(8451);
  const sampleCanonicalRoute = {
    id: canonicalRouteId,
    name: 'Tour du Mont Blanc',
    distanceKm: 170.0,
    geom: {
      type: 'LineString' as const,
      coordinates: [
        [6.86, 45.92],
        [6.88, 45.94],
      ],
    },
  };

  it('1. Compas consomme directement la route canonique sans requête OSM', () => {
    const compasPayload = buildCompasPayload(sampleCanonicalRoute);
    expect(compasPayload.routeId).toBe(canonicalRouteId);
    expect(compasPayload.name).toBe('Tour du Mont Blanc');
    expect(compasPayload.distanceKm).toBe(170.0);
    expect(compasPayload.geometry).toEqual(sampleCanonicalRoute.geom);
  });

  it('2. HikeSession sépare strictement la route officielle de la trace GPS réelle de l’utilisateur', () => {
    const session: HikeSessionRecord = {
      id: 'session-uuid-123' as HikeSessionId,
      userId: 'user-tony-456',
      routeId: canonicalRouteId,
      startedAt: '2026-08-01T07:00:00Z',
      endedAt: '2026-08-01T17:30:00Z',
      distanceKm: 18.4, // Marche réelle de la journée
      durationSeconds: 37800,
      elevationGainM: 1120,
      // La trace GPS réelle enregistrée par le téléphone
      positionsGeojson: {
        type: 'LineString',
        coordinates: [
          [6.8601, 45.9202],
          [6.8654, 45.9255],
        ],
      },
      poiEvents: [
        { poiName: 'Refuge de Bellachat', lat: 45.925, lon: 6.865, reachedAt: '2026-08-01T12:00:00Z' },
      ],
    };

    expect(session.routeId).toBe(canonicalRouteId);
    // La trace officielle TMB n'est PAS écrasée par la trace GPS du marcheur
    expect(session.positionsGeojson.coordinates).not.toEqual(sampleCanonicalRoute.geom.coordinates);
    expect(session.distanceKm).toBe(18.4);
  });

  it('3. Publication Communautaire référence routeId + snapshot sans dupliquer la géométrie', () => {
    const post = createCommunityPost(
      'user-tony-456',
      'Étape 1 du TMB terminée sous le soleil !',
      sampleCanonicalRoute,
      {
        id: 'session-uuid-123' as HikeSessionId,
        distanceKm: 18.4,
        elevationGainM: 1120,
        durationSeconds: 37800,
      }
    );

    expect(post.routeId).toBe(canonicalRouteId);
    expect(post.hikeSessionId).toBe('session-uuid-123');
    expect(post.snapshot.title).toBe('Tour du Mont Blanc');
    expect(post.snapshot.distanceKm).toBe(18.4);
    expect(post.snapshot.elevationGainM).toBe(1120);
    // Aucune copie massive de coordonnées dans le post communautaire
    expect((post as any).geometry).toBeUndefined();
  });

  it('4. Les statistiques Profil proviennent des activités réellement accomplies, jamais des routes consultées', () => {
    const routeA = toRouteId(101);
    const routeB = toRouteId(102);

    const completed = [
      { routeId: routeA, distanceKm: 12.0, elevationGainM: 600 },
      { routeId: routeA, distanceKm: 12.5, elevationGainM: 610 }, // Même route refaite 2 fois
      { routeId: routeB, distanceKm: 25.0, elevationGainM: 1400 },
    ];

    const stats = computeUserOutdoorStats('user-tony-456', completed);
    expect(stats.sortiesCount).toBe(3);
    expect(stats.totalDistanceKm).toBe(49.5);
    expect(stats.totalElevationGainM).toBe(2610);
    expect(stats.distinctRoutesHikedCount).toBe(2); // 2 routes distinctes
  });
});
