import { describe, expect, it } from 'vitest';
import {
  buildChatGptConnectorManifest,
  readChatGptConnectorStatus,
} from '../connectors/chatgpt';
import {
  discoverRoutes,
  routeDiscoveryRequestSchema,
  toRouteCandidate,
  type CompasRouteRow,
} from '../connectors/routeDiscovery';

const row = (overrides: Partial<CompasRouteRow> = {}): CompasRouteRow => ({
  route_id: 10,
  name: 'Tour du Mont-Blanc',
  ref: 'TMB',
  region: 'Alpes',
  distance_km: 10,
  elevation_gain_m: 500,
  elevation_loss_m: 500,
  duration_hours: 3,
  difficulty: 'moderee',
  distance_from_m: 1200,
  start_lat: 45.9,
  start_lng: 6.8,
  community_sessions: 12,
  ...overrides,
});

describe('K1.14 — connecteur ChatGPT et recherche de parcours', () => {
  it('reste indisponible tant que l’arbitrage n’active pas le connecteur', () => {
    expect(readChatGptConnectorStatus({}).status).toBe('unavailable');
    expect(readChatGptConnectorStatus({ CHATGPT_CONNECTOR_ENABLED: 'true' }).status).toBe('available');
    expect(
      readChatGptConnectorStatus({ CHATGPT_CONNECTOR_ENABLED: 'true', AI_MODE: 'off' }).reason
    ).toBe('connector_disabled');
  });

  it('publie un manifeste sans entrée de navigation et avec les limites de terrain', () => {
    const manifest = buildChatGptConnectorManifest({ CHATGPT_CONNECTOR_ENABLED: 'true' });
    expect(manifest.navigationEntry).toBe('none');
    expect(manifest.tools[0].name).toBe('search_routes');
    expect(manifest.terrainConstraints.available).toContain('distanceKm (hiking_routes.distance_km)');
    expect(manifest.terrainConstraints.unavailable).toContain('surface (non agrégée au parcours)');
  });

  it('conserve le zéro et marque l’absence sans l’inventer', () => {
    const candidate = toRouteCandidate(row({ distance_km: 0, elevation_gain_m: null }));
    expect(candidate.distanceKm).toMatchObject({ value: 0, status: 'measured' });
    expect(candidate.elevationGainM.status).toBe('absent');
    expect(candidate.elevationGainM.value).toBeNull();
  });

  it('applique les contraintes et expose celles qui sont inconnues', () => {
    const request = routeDiscoveryRequestSchema.parse({
      query: 'mont',
      constraints: {
        distanceKm: { min: 5, max: 15 },
        elevationGainM: { min: 300 },
        difficulty: ['moderee'],
      },
    });
    const result = discoverRoutes(request, [
      row({ route_id: 1, name: 'Mont A', distance_km: 10, elevation_gain_m: 500 }),
      row({ route_id: 2, name: 'Mont B', distance_km: 12, elevation_gain_m: null }),
      row({ route_id: 3, name: 'Mont C', distance_km: 8, elevation_gain_m: 100 }),
    ]);
    expect(result.results.map((entry) => entry.id)).toEqual(['1']);
    expect(result.excluded.map((entry) => entry.id)).toEqual(['2', '3']);
    expect(result.unknownConstraints.join(' ')).toContain('dénivelé positif inconnu');
    expect(result.count).toBe(1);
  });

  it('refuse une requête sans texte ni position', () => {
    expect(routeDiscoveryRequestSchema.safeParse({}).success).toBe(false);
    expect(routeDiscoveryRequestSchema.safeParse({ near: { lat: 45, lng: 6 } }).success).toBe(true);
  });

  it('rend un résultat vide explicite, jamais un parcours inventé', () => {
    const request = routeDiscoveryRequestSchema.parse({ query: 'introuvable' });
    const result = discoverRoutes(request, [row()]);
    expect(result.results).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.excluded[0]?.reason).toContain('texte');
  });
});
