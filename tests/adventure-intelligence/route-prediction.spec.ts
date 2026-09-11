import { describe, it, expect, vi } from 'vitest';
import {
  ROUTE_MAP_MATCHED_CONTEXT_HASH,
  ROUTE_PREDICTION_MODEL_VERSION,
  UNIFORM_ROUTE_CONTEXT_HASH,
  persistRoutePredictions,
  predictRouteFromPolyline,
  type RoutePredictionBundle,
  type RoutePredictionClient,
  type RoutePredictionResult,
} from '@/features/adventure-intelligence/server/routePrediction';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import type { SegmentCandidate } from '@/features/adventure-intelligence/domain/mapMatching';
import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';
import {
  generateAdventure,
  type AdventureEnginePersistence,
  type AdventurePredictionBundle,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';

const USER_ID = 'a1311111-1111-4111-8111-111111111111';
const PLAN_ID = 'a1322222-2222-4222-8222-222222222222';
const NOW = '2026-09-11T08:00:00.000Z';

function northPolyline(count = 6): { lat: number; lng: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: 44 + index * 0.0001,
    lng: 6,
  }));
}

function candidateFor(point: { lat: number; lng: number }, index: number): SegmentCandidate {
  return { segmentId: 1000 + index, distanceM: 5, bearingDeg: 0, highway: 'path', surface: 'ground', sacScale: 'hiking' };
}

function geometryFor(id: number) {
  return {
    id,
    geojson: { type: 'LineString', coordinates: [[6, 44], [6, 44.001]] },
    surface: 'ground',
    sacScale: 'hiking',
    highway: 'path',
  };
}

function fastProfile(): PerformanceProfile {
  const confidence = makeConfidence({ score: 0.8, sampleCount: 12, method: 'weighted_median_a3' });
  const curve = { points: [{ x: 0, value: 1 }], interpolate: 'linear' as const };
  return {
    userId: USER_ID,
    activityType: 'hiking',
    flatSpeedKmH: 6,
    ascentSpeedMPerHour: 600,
    descentSpeedMPerHour: 900,
    gradeResponse: curve,
    surfaceResponse: curve,
    fatigueCurve: { points: [{ x: 0, value: 1 }], decayPerHour: 0 },
    pauseModel: { pauseMinutesPerHour: 0, pauseMinutesPerAscentM: 0, minPauseMinutes: 0 },
    packResponse: curve,
    confidence,
    sampleCount: 12,
    calibrationLevel: 'personalization',
    modelVersion: 'a3-v1',
    computedAt: NOW,
  };
}

interface ClientOptions {
  consent?: boolean;
  profile?: PerformanceProfile | null;
  profileError?: boolean;
  persistError?: boolean;
  candidates?: (points: { lat: number; lng: number }[]) => SegmentCandidate[][];
}

function makeClient(options: ClientOptions = {}) {
  const persisted: RoutePredictionBundle[] = [];
  const matchCalls: { points: { lat: number; lng: number }[]; radiusM: number }[] = [];
  const geometryCalls: number[][] = [];

  const matchTrackCandidates = vi.fn(
    async (points: { lat: number; lng: number }[], radiusM: number) => {
      matchCalls.push({ points, radiusM });
      if (options.candidates) return options.candidates(points);
      return points.map(() => [{ segmentId: 777, distanceM: 5, bearingDeg: 0 }]);
    }
  );
  const getSegmentGeometries = vi.fn(async (ids: number[]) => {
    geometryCalls.push([...ids]);
    return ids.map(geometryFor);
  });
  const hasActiveConsent = vi.fn(async () => options.consent === true);
  const getCurrentProfile = vi.fn(async () => {
    if (options.profileError) throw new Error('profil indisponible');
    return options.profile ?? null;
  });
  const persistPredictions = vi.fn(async (bundle: RoutePredictionBundle) => {
    if (options.persistError) throw new Error('persistance indisponible');
    persisted.push(bundle);
  });

  const client: RoutePredictionClient = {
    matchTrackCandidates,
    getSegmentGeometries,
    hasActiveConsent,
    getCurrentProfile,
    persistPredictions,
  };

  return {
    client,
    persisted,
    matchCalls,
    geometryCalls,
    matchTrackCandidates,
    getSegmentGeometries,
    hasActiveConsent,
    getCurrentProfile,
    persistPredictions,
  };
}

function input(overrides: Partial<Parameters<typeof predictRouteFromPolyline>[0]> = {}) {
  return {
    userId: USER_ID,
    planId: PLAN_ID,
    polyline: northPolyline(),
    startAt: NOW,
    ...overrides,
  };
}

function routeKeys(bundle: RoutePredictionBundle): string[] {
  return bundle.route.map(
    (row) => `${row.user_id}|${row.plan_id}|${row.strategy}|${row.model_version}`
  );
}

function segmentKeys(bundle: RoutePredictionBundle): string[] {
  return bundle.segments.map(
    (row) => `${row.user_id}|${row.segment_id}|${row.context_hash}|${row.model_version}`
  );
}

describe('A13 — ETA réelle bout-en-bout (TEST-A13-ROUTE)', () => {
  it('TEST-A13-ROUTE-01: polyline → candidats batch → géométries → features → prédictions', async () => {
    const harness = makeClient({ consent: false });

    const result = await predictRouteFromPolyline(input(), harness.client);

    expect(harness.matchTrackCandidates).toHaveBeenCalledTimes(1);
    expect(harness.matchCalls[0].points).toHaveLength(6);
    expect(harness.matchCalls[0].radiusM).toBe(35);
    expect(harness.getSegmentGeometries).toHaveBeenCalledWith([777]);

    expect(result.contextHash).toBe(ROUTE_MAP_MATCHED_CONTEXT_HASH);
    expect(result.segmentation).toBe('map_matched');
    expect(result.segments.length).toBe(1);
    expect(result.segments[0].segmentId).toBe(777);
    expect(result.segments[0].durationP50Seconds).toBeGreaterThan(0);
    expect(result.segments[0].durationP90Seconds).toBeGreaterThanOrEqual(
      result.segments[0].durationP50Seconds
    );

    expect(result.strategies.map((strategy) => strategy.strategy)).toEqual([
      'comfort',
      'recommended',
      'fast',
    ]);
    expect(result.primary.strategy).toBe('recommended');
    expect(result.primary.userId).toBe(USER_ID);
    expect(Date.parse(result.primary.etaP90)).toBeGreaterThanOrEqual(Date.parse(result.primary.etaP50));

    expect(result.segmentsCritical).toEqual(result.primary.criticalSegmentIds);
    expect(result.segmentsCritical).toContain(777);

    const step = result.stepSources.find((entry) => entry.segmentId === 777);
    expect(step).toMatchObject({
      segmentId: 777,
      geometrySource: 'a13_segment_geometries',
    });
  });

  it('TEST-A13-ROUTE-02: profil réel uniquement si consentement personal_performance', async () => {
    const standard = makeClient({ consent: false, profile: fastProfile() });
    const personal = makeClient({ consent: true, profile: fastProfile() });

    const standardResult = await predictRouteFromPolyline(input(), standard.client);
    const personalResult = await predictRouteFromPolyline(input(), personal.client);

    expect(standard.hasActiveConsent).toHaveBeenCalledWith(USER_ID, 'personal_performance');
    expect(personal.hasActiveConsent).toHaveBeenCalledWith(USER_ID, 'personal_performance');

    // Sans consentement, le profil n'est jamais lu, même présent côté client.
    expect(standard.getCurrentProfile).not.toHaveBeenCalled();
    expect(personal.getCurrentProfile).toHaveBeenCalledWith(USER_ID);

    expect(standardResult.profileSource).toBe('standard');
    expect(personalResult.profileSource).toBe('profile');
    expect(standardResult.provenance.source).toBe('computed');
    expect(personalResult.provenance.source).toBe('measured');

    expect(standardResult.stepSources[0].paceSource).toBe('standard');
    expect(personalResult.stepSources[0].paceSource).toBe('profile');

    // Profil rapide (6 km/h ⇒ 10 min/km) strictement plus rapide que 15 min/km.
    expect(personalResult.primary.totalDurationP50Seconds).toBeLessThan(
      standardResult.primary.totalDurationP50Seconds
    );
    expect(standardResult.warnings.some((warning) => warning.code === 'personal_profile_unavailable')).toBe(true);
  });

  it('TEST-A13-ROUTE-03: persistance persist_adventure_predictions avec modèle a13-v1', async () => {
    const harness = makeClient({ consent: true, profile: fastProfile() });

    const result = await predictRouteFromPolyline(input(), harness.client);

    expect(harness.persistPredictions).toHaveBeenCalledTimes(1);
    const bundle = harness.persisted[0];
    expect(bundle.planId).toBe(PLAN_ID);
    expect(bundle.userId).toBe(USER_ID);
    expect(bundle.route.map((row) => row.strategy)).toEqual(['comfort', 'recommended', 'fast']);
    expect(bundle.segments.length).toBeGreaterThan(0);
    for (const row of bundle.segments) {
      expect(row).toMatchObject({
        user_id: USER_ID,
        model_version: ROUTE_PREDICTION_MODEL_VERSION,
        context_hash: ROUTE_MAP_MATCHED_CONTEXT_HASH,
      });
    }
    for (const row of bundle.route) {
      expect(row).toMatchObject({
        user_id: USER_ID,
        plan_id: PLAN_ID,
        model_version: ROUTE_PREDICTION_MODEL_VERSION,
      });
    }
    expect(ROUTE_PREDICTION_MODEL_VERSION).toBe('a13-v1');

    // Un second plan (même prédiction) est persisté avec le bon plan_id.
    harness.persistPredictions.mockClear();
    await persistRoutePredictions(result, 'a1333333-3333-4333-8333-333333333333', harness.client);
    expect(harness.persisted[1].planId).toBe('a1333333-3333-4333-8333-333333333333');
  });

  it('TEST-A13-ROUTE-04: sans route, fallback uniform_from_blueprint explicite (jamais silencieux)', async () => {
    const harness = makeClient({ consent: false });
    const itinerary = { totalDistanceKm: 12, totalGainM: 600, totalLossM: 600, stagesCount: 3 };

    const missing = await predictRouteFromPolyline(input({ polyline: null, itinerary }), harness.client);
    const empty = await predictRouteFromPolyline(input({ polyline: [], itinerary }), harness.client);

    for (const result of [missing, empty]) {
      expect(result.contextHash).toBe(UNIFORM_ROUTE_CONTEXT_HASH);
      expect(result.segmentation).toBe('uniform_from_blueprint');
      expect(result.provenance).toMatchObject({
        source: 'computed',
        sourceRef: 'a13:uniform_from_blueprint',
      });
      const warning = result.warnings.find((entry) => entry.code === 'route_geometry_missing');
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('warning');
      expect(warning?.message.length).toBeGreaterThan(0);
      expect(result.segments.map((segment) => segment.segmentId)).toEqual([1, 2, 3]);
    }

    // Aucun appel de géométrie/map-matching : le repli ne prétend pas avoir routé.
    expect(harness.matchTrackCandidates).not.toHaveBeenCalled();
    expect(harness.getSegmentGeometries).not.toHaveBeenCalled();

    // Les pseudo-segments uniformes ne sont jamais persistés (segment ids inventés).
    const bundle = harness.persisted[0];
    expect(bundle.segments).toHaveLength(0);
    expect(bundle.route).toHaveLength(3);
  });

  it('TEST-A13-ROUTE-05: borne des géométries à 500 ids par appel RPC', async () => {
    const harness = makeClient({
      consent: false,
      candidates: (points) => points.map((_point, index) => [candidateFor(_point, index)]),
    });

    const result = await predictRouteFromPolyline(
      input({ polyline: northPolyline(600) }),
      harness.client
    );

    expect(result.segments).toHaveLength(600);
    expect(harness.geometryCalls.length).toBeGreaterThan(1);
    for (const call of harness.geometryCalls) {
      expect(call.length).toBeLessThanOrEqual(500);
      expect(call.length).toBeGreaterThan(0);
    }
    const requested = harness.geometryCalls.flat();
    expect(requested).toHaveLength(600);
    expect(new Set(requested).size).toBe(600);
  });

  it('TEST-A13-ROUTE-06: idempotence par modèle — mêmes clés (user, segment/plan, version)', async () => {
    const first = makeClient({ consent: true, profile: fastProfile() });
    const second = makeClient({ consent: true, profile: fastProfile() });

    await predictRouteFromPolyline(input(), first.client);
    await predictRouteFromPolyline(input(), second.client);

    expect(segmentKeys(first.persisted[0])).toEqual(segmentKeys(second.persisted[0]));
    expect(routeKeys(first.persisted[0])).toEqual(routeKeys(second.persisted[0]));
    for (const row of first.persisted[0].segments) {
      expect(row.model_version).toBe('a13-v1');
    }
  });
});

describe('A13 — Intégration generateAdventure (TEST-A13-ROUTE-INT)', () => {
  const TEXT =
    'Trek de 7 jours au Tour du Mont-Blanc en juillet en refuge avec un budget de 800 €';

  function makeGenerationDeps(routeClient?: RoutePredictionClient) {
    const persistedPredictions: AdventurePredictionBundle[] = [];
    const persistence: AdventureEnginePersistence = {
      persistPlanBundle: vi.fn(async () => ({ id: PLAN_ID })),
      insertEngineRun: vi.fn(async () => {}),
    };
    return {
      deps: {
        registry: createDefaultRegistry(),
        persistence,
        hasActiveConsent: vi.fn(async () => true),
        getCurrentProfile: vi.fn(async () => fastProfile()),
        persistAdventurePredictions: vi.fn(async (bundle: AdventurePredictionBundle) => {
          persistedPredictions.push(bundle);
        }),
        ...(routeClient ? { routePredictionClient: routeClient } : {}),
      },
      persistedPredictions,
    };
  }

  it('TEST-A13-ROUTE-07: polyline du brief ⇒ paceStrategies réelles + persistance a13-v1', async () => {
    const routeHarness = makeClient({ consent: true, profile: fastProfile() });
    const harness = makeGenerationDeps(routeHarness.client);

    const result = await generateAdventure(
      { ownerId: USER_ID, text: TEXT, now: NOW, coordinates: northPolyline(6) },
      harness.deps
    );

    const pace = result.plan.sections.paceStrategies;
    expect(pace).not.toBeNull();
    expect(pace?.value).toMatchObject({
      segmentation: 'map_matched',
      profileSource: 'profile',
    });
    expect(pace?.provenance[0]).toMatchObject({
      source: 'measured',
      sourceRef: 'a13:routePrediction',
    });

    expect(routeHarness.persistPredictions).toHaveBeenCalledTimes(1);
    const bundle = routeHarness.persisted[0];
    expect(bundle.planId).toBe(PLAN_ID);
    expect(bundle.route).toHaveLength(3);
    expect(bundle.route.map((row) => row.strategy)).toEqual(['comfort', 'recommended', 'fast']);
    expect(bundle.route.every((row) => row.model_version === 'a13-v1')).toBe(true);
    expect(bundle.segments.length).toBeGreaterThan(0);
    expect(bundle.segments.every((row) => row.model_version === 'a13-v1')).toBe(true);

    // Le flux réel remplace l'uniforme : aucune double persistance A10.
    expect(harness.deps.persistAdventurePredictions).not.toHaveBeenCalled();
    expect(harness.persistedPredictions).toHaveLength(0);
  });

  it('TEST-A13-ROUTE-08: sans polyline ⇒ repli uniform_from_blueprint explicite et persisté', async () => {
    const routeHarness = makeClient({ consent: false });
    const harness = makeGenerationDeps(routeHarness.client);

    const result = await generateAdventure(
      { ownerId: USER_ID, text: TEXT, now: NOW },
      harness.deps
    );

    const pace = result.plan.sections.paceStrategies;
    expect(pace?.value).toMatchObject({ segmentation: 'uniform_from_blueprint' });
    expect(pace?.provenance[0]).toMatchObject({
      source: 'computed',
      sourceRef: 'a13:uniform_from_blueprint',
    });
    expect(
      (pace?.warnings ?? []).some(
        (warning) => warning.code === 'route_geometry_missing' && warning.severity === 'warning'
      )
    ).toBe(true);

    expect(routeHarness.persistPredictions).toHaveBeenCalledTimes(1);
    // Pseudo-segments du blueprint jamais persistés (ids non réels).
    expect(routeHarness.persisted[0].segments).toHaveLength(0);
    expect(routeHarness.persisted[0].route).toHaveLength(3);
  });
});
