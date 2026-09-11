import { describe, it, expect, vi } from 'vitest';
import {
  DOCUMENTS_NO_DETERMINISTIC_SOURCE_WARNING,
  FOOD_WATER_NO_SOURCE_WARNING,
  LIVE_CONDITIONS_NO_SOURCE_WARNING,
  REGULATIONS_NO_DETERMINISTIC_SOURCE_WARNING,
  TERRAIN_ROUTE_MAX_RADIUS_M,
  TRAIL_POI_BBOX_MARGIN_DEG,
  buildFoodWaterSection,
  buildLiveConditionsSection,
  clampTerrainRadiusM,
  resolveLiveSources,
  routeBbox,
  sampleRoutePoints,
  type LiveSourcesClient,
  type RouteBbox,
  type TrailPoiRow,
} from '@/features/adventure-intelligence/server/liveSources';
import {
  generateAdventure,
  type AdventureEnginePersistence,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';
import type { PlanValue } from '@/features/adventure-intelligence/domain/adventurePlan';
import type { TerrainLiveReport } from '@/features/terrain-live/lib/terrainDisplay';

const USER_ID = 'a1344444-4444-4444-8444-444444444444';
const PLAN_ID = 'a1355555-5555-4555-8555-555555555555';
const NOW = '2026-09-11T09:00:00.000Z';

function polyline(count = 6): { lat: number; lng: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: 44.1 + index * 0.01,
    lng: 6.2 + index * 0.01,
  }));
}

function weatherSection(): PlanValue<unknown> {
  return {
    value: {
      provider: 'open-meteo',
      coordinates: { lat: 44.1, lng: 6.2 },
      days: [{ date: '2026-09-12', tempMinC: 4, tempMaxC: 15 }],
      current: { tempC: 10, condition: 'clair' },
      fetchedAt: NOW,
    },
    confidence: { score: 0.7, level: 'medium', sampleCount: 0, method: 'weather:open-meteo', reasons: [] },
    provenance: [
      { source: 'official', sourceRef: 'open-meteo', observedAt: NOW, notes: 'Prévisions 1 jour(s)' },
    ],
    assumptions: [],
    warnings: [],
    impacts: [],
    computedAt: NOW,
  };
}

function report(id: string, sourceType: 'user' | 'official' = 'user'): TerrainLiveReport {
  return {
    id,
    category: 'obstacle',
    severity: 'warning',
    passability: 'difficult',
    lat: 44.11,
    lng: 6.21,
    sourceType,
    status: 'active',
    presentCount: 2,
    goneCount: 0,
    unknownCount: 0,
    reportCount: 1,
    createdAt: NOW,
    distanceM: 120,
  };
}

function poi(overrides: Partial<TrailPoiRow> = {}): TrailPoiRow {
  return {
    id: 1,
    name: 'Source du Pré',
    category: 'water',
    description: null,
    lat: 44.12,
    lng: 6.22,
    tags: { drinking_water: 'yes' },
    ...overrides,
  };
}

function makeClient(options: {
  reports?: TerrainLiveReport[];
  pois?: TrailPoiRow[];
  reportsError?: boolean;
  poisError?: boolean;
}): LiveSourcesClient & {
  terrainCalls: { lat: number; lng: number; radiusM: number }[];
  poiCalls: { bbox: RouteBbox; limit: number }[];
} {
  const terrainCalls: { lat: number; lng: number; radiusM: number }[] = [];
  const poiCalls: { bbox: RouteBbox; limit: number }[] = [];
  return {
    terrainCalls,
    poiCalls,
    async listTerrainReportsNear(query) {
      terrainCalls.push({ ...query });
      if (options.reportsError) throw new Error('terrain indisponible');
      return options.reports ?? [];
    },
    async listTrailPoisBbox(bbox, limit) {
      poiCalls.push({ bbox, limit });
      if (options.poisError) throw new Error('pois indisponibles');
      return options.pois ?? [];
    },
  };
}

describe('A13 — Sources vivantes (TEST-A13-SRC)', () => {
  it('TEST-A13-SRC-01: liveConditions fusionne météo officielle et Terrain Live communautaire sans rien inventer', () => {
    const official = report('a1344444-0000-4000-8000-000000000001', 'official');
    const community = report('a1344444-0000-4000-8000-000000000002', 'user');

    const merged = buildLiveConditionsSection({
      weatherSection: weatherSection(),
      terrainReports: [community, official],
      now: NOW,
    });

    expect(merged.warnings).toEqual([]);
    expect(merged.section).not.toBeNull();
    const value = merged.section?.value as {
      days: unknown[];
      terrainReports: TerrainLiveReport[];
    };
    // La météo réelle est conservée telle quelle (jamais recalculée).
    expect(value.days).toHaveLength(1);
    expect(value.terrainReports.map((entry) => entry.id)).toEqual([community.id, official.id]);
    const sources = (merged.section?.provenance ?? []).map((entry) => entry.source);
    expect(sources).toContain('official');
    expect(sources).toContain('community');
    // Aucun signalement inventé : les identifiants passés sortent tels quels.
    expect(merged.section?.computedAt).toBe(NOW);
  });

  it('TEST-A13-SRC-02: Terrain Live interrogé autour de la route (points bornés, rayon borné, dédoublonnage)', async () => {
    const bbox = routeBbox(polyline(9));
    expect(bbox).not.toBeNull();
    expect(bbox?.minLat).toBeCloseTo(44.1);
    expect(bbox?.maxLat).toBeCloseTo(44.18);

    const points = sampleRoutePoints(polyline(9));
    expect(points.length).toBeLessThanOrEqual(5);
    expect(points[0]).toEqual(polyline(9)[0]);
    expect(points[points.length - 1]).toEqual(polyline(9)[8]);

    expect(clampTerrainRadiusM(999_999)).toBe(TERRAIN_ROUTE_MAX_RADIUS_M);
    expect(clampTerrainRadiusM(250)).toBe(250);

    const duplicated = report('a1344444-0000-4000-8000-000000000010');
    const client = makeClient({ reports: [duplicated] });
    const resolved = await resolveLiveSources({
      polyline: polyline(9),
      weatherSection: null,
      fallbackFoodWater: null,
      now: NOW,
      client,
    });

    expect(client.terrainCalls.length).toBeGreaterThan(0);
    expect(client.terrainCalls.length).toBeLessThanOrEqual(5);
    for (const call of client.terrainCalls) {
      expect(call.radiusM).toBeLessThanOrEqual(TERRAIN_ROUTE_MAX_RADIUS_M);
      expect(call.radiusM).toBeGreaterThan(0);
    }
    // Le même rapport vu depuis plusieurs points ne compte qu'une fois.
    const value = resolved.liveConditions?.value as { terrainReports: TerrainLiveReport[] };
    expect(value.terrainReports).toHaveLength(1);
    expect(resolved.warnings.some((warning) => warning.code === 'terrain_live_unavailable')).toBe(
      false
    );
  });

  it('TEST-A13-SRC-03: foodAndWater construit depuis trail_pois (eau/refuges) sur la bbox route, provenance OSM', async () => {
    const bbox = routeBbox(polyline(9)) as RouteBbox;
    const client = makeClient({
      pois: [
        poi({ id: 1, name: 'Source', category: 'water', tags: { drinking_water: 'yes' } }),
        poi({ id: 2, name: 'Refuge du Col', category: 'alpine_hut', tags: {} }),
        poi({ id: 3, name: 'Sommet', category: 'peak', tags: {} }),
        poi({ id: 4, name: 'Fontaine', category: 'spring', tags: { drinking_water: 'no' } }),
      ],
    });

    const resolved = await resolveLiveSources({
      polyline: polyline(9),
      weatherSection: null,
      fallbackFoodWater: null,
      now: NOW,
      client,
    });

    expect(client.poiCalls).toHaveLength(1);
    expect(client.poiCalls[0].bbox.minLat).toBeCloseTo(bbox.minLat - TRAIL_POI_BBOX_MARGIN_DEG);
    expect(client.poiCalls[0].bbox.maxLat).toBeCloseTo(bbox.maxLat + TRAIL_POI_BBOX_MARGIN_DEG);
    expect(client.poiCalls[0].bbox.minLng).toBeCloseTo(bbox.minLng - TRAIL_POI_BBOX_MARGIN_DEG);
    expect(client.poiCalls[0].bbox.maxLng).toBeCloseTo(bbox.maxLng + TRAIL_POI_BBOX_MARGIN_DEG);

    const section = resolved.foodAndWater;
    expect(section).not.toBeNull();
    expect(section?.provenance[0]).toMatchObject({ source: 'official', sourceRef: 'osm:trail_pois' });
    const value = section?.value as {
      waterPoints: { id: number; potable: boolean | null }[];
      refuges: { id: number }[];
    };
    expect(value.waterPoints.map((entry) => entry.id)).toEqual([1, 4]);
    expect(value.waterPoints[0].potable).toBe(true);
    expect(value.waterPoints[1].potable).toBe(false);
    expect(value.refuges.map((entry) => entry.id)).toEqual([2]);
    // Les POI hors périmètre eau/refuge ne sont jamais intégrés.
    expect(JSON.stringify(value)).not.toContain('Sommet');
    // Seule l'absence de conditions vivantes est signalée (aucun POI perdu).
    expect(resolved.warnings.map((warning) => warning.code)).toEqual([
      LIVE_CONDITIONS_NO_SOURCE_WARNING.code,
    ]);
  });

  it('TEST-A13-SRC-04: absence de source ⇒ null + warning dédié, jamais de valeur inventée', async () => {
    const noWeather = buildLiveConditionsSection({
      weatherSection: null,
      terrainReports: [],
      now: NOW,
    });
    expect(noWeather.section).toBeNull();
    expect(noWeather.warnings.map((warning) => warning.code)).toEqual([
      LIVE_CONDITIONS_NO_SOURCE_WARNING.code,
    ]);

    const noPois = buildFoodWaterSection({ bbox: routeBbox(polyline(4)), pois: [], now: NOW });
    expect(noPois.section).toBeNull();
    expect(noPois.warnings.map((warning) => warning.code)).toEqual([
      FOOD_WATER_NO_SOURCE_WARNING.code,
    ]);

    expect(REGULATIONS_NO_DETERMINISTIC_SOURCE_WARNING.severity).toBe('warning');
    expect(DOCUMENTS_NO_DETERMINISTIC_SOURCE_WARNING.severity).toBe('warning');

    const client = makeClient({ reports: [], pois: [] });
    const resolved = await resolveLiveSources({
      polyline: polyline(4),
      weatherSection: null,
      fallbackFoodWater: null,
      now: NOW,
      client,
    });
    expect(resolved.liveConditions).toBeNull();
    expect(resolved.foodAndWater).toBeNull();
    const codes = resolved.warnings.map((warning) => warning.code);
    expect(codes).toContain(LIVE_CONDITIONS_NO_SOURCE_WARNING.code);
    expect(codes).toContain(FOOD_WATER_NO_SOURCE_WARNING.code);
  });

  it('TEST-A13-SRC-05: generateAdventure branche les sources réelles quand des coordonnées de route sont fournies', async () => {
    const persistence: AdventureEnginePersistence = {
      persistPlanBundle: vi.fn(async () => ({ id: PLAN_ID })),
      insertEngineRun: vi.fn(async () => {}),
    };
    const client = makeClient({
      reports: [report('a1344444-0000-4000-8000-000000000020')],
      pois: [poi({ id: 10, name: 'Source', category: 'water', tags: { drinking_water: 'yes' } })],
    });

    const withRoute = await generateAdventure(
      {
        ownerId: USER_ID,
        text: 'Trek de 3 jours au Mercantour en juillet en refuge avec un budget de 300 €',
        now: NOW,
        coordinates: polyline(5),
      },
      {
        registry: createDefaultRegistry(),
        persistence,
        hasActiveConsent: async () => false,
        getCurrentProfile: async () => null,
        persistAdventurePredictions: async () => {},
        liveSourcesClient: client,
      }
    );

    expect(withRoute.plan.sections.liveConditions).not.toBeNull();
    expect(
      (withRoute.plan.sections.liveConditions?.provenance ?? []).some(
        (entry) => entry.source === 'community' && entry.sourceRef === 'a5_terrain_reports_near'
      )
    ).toBe(true);
    expect(withRoute.plan.sections.foodAndWater?.provenance[0]).toMatchObject({
      source: 'official',
      sourceRef: 'osm:trail_pois',
    });
    expect(withRoute.liveSourceWarnings).toEqual([]);
    const terrainCallsAfterRoute = client.terrainCalls.length;
    const poiCallsAfterRoute = client.poiCalls.length;
    expect(terrainCallsAfterRoute).toBeGreaterThan(0);
    expect(poiCallsAfterRoute).toBe(1);

    const withoutRoute = await generateAdventure(
      {
        ownerId: USER_ID,
        text: 'Trek de 3 jours au Mercantour en juillet en refuge avec un budget de 300 €',
        now: NOW,
      },
      {
        registry: createDefaultRegistry(),
        persistence,
        hasActiveConsent: async () => false,
        getCurrentProfile: async () => null,
        persistAdventurePredictions: async () => {},
        liveSourcesClient: client,
      }
    );

    // Sans polyline, aucune requête autour de la route n'est émise et aucun
    // signalement Terrain Live n'est jamais rattaché à la section.
    const withoutValue = withoutRoute.plan.sections.liveConditions?.value as
      | { terrainReports?: unknown }
      | undefined;
    expect(withoutValue?.terrainReports).toBeUndefined();
    expect(client.poiCalls).toHaveLength(poiCallsAfterRoute);
    expect(client.terrainCalls).toHaveLength(terrainCallsAfterRoute);
  });
});
