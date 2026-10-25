import { describe, it, expect, vi } from 'vitest';
import {
  MAX_OFFLINE_PACK_BYTES,
  MAX_OFFLINE_PACK_SEGMENTS,
  OFFLINE_PACK_PLAN_NOT_FOUND_WARNING,
  OFFLINE_PACK_TRUNCATED_WARNING,
  buildOfflinePack,
  type OfflinePackClient,
} from '@/features/adventure-intelligence/server/offlinePack';
import {
  offlinePackRequest,
  packCacheEntries,
  shouldStoreOfflinePack,
} from '@/features/adventure-intelligence/offline/pack';
import {
  syncOfflineBatch,
  type OfflineSyncClient,
  type OfflineSyncAppliedRecord,
} from '@/features/adventure-intelligence/server/offlineSync';
import {
  createAdventureSyncTransport,
  syncPendingOperations,
  type SyncWorkerStorage,
} from '@/features/adventure-intelligence/offline/syncWorker';import { createOfflineOperation, type OfflineOperation, type OfflineStoreRef } from '@/features/adventure-intelligence/offline/operations';
import {
  ADVENTURE_OFFLINE_DB_PREFIX,
  offlineDbNameForUser,
  purgeOfflineData,
} from '@/features/adventure-intelligence/offline/db';
import {
  adventureDecisionSchema,
  adventurePlanSchema,
} from '@/features/adventure-intelligence/schemas/adventurePlan.schema';
import type { StoredAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';
import type { SegmentGeometryRow } from '@/features/adventure-intelligence/server/routePrediction';
import type { TerrainLiveReport } from '@/features/terrain-live/lib/terrainDisplay';

const USER_A = 'a13f0001-1111-4111-8111-111111111111';
const USER_B = 'a13f0002-2222-4222-8222-222222222222';
const PLAN_ID = 'a13f0003-3333-4333-8333-333333333333';
const MEMBER_ID = 'a13f0004-4444-4444-8444-444444444444';
const MEMBER_PROFILE_ID = 'a13f0005-5555-4555-8555-555555555555';
const NOW = '2026-09-11T12:00:00.000Z';

function planValue(value: unknown) {
  return {
    value,
    confidence: { score: 0.8, level: 'medium', sampleCount: 4, method: 'test' },
    provenance: [],
    assumptions: [],
    warnings: [],
    impacts: [],
    computedAt: NOW,
  };
}

function makePlan(segmentIds: number[] = [101, 102]) {
  return adventurePlanSchema.parse({
    id: PLAN_ID,
    ownerId: USER_A,
    title: 'Trek hors-ligne',
    status: 'active',
    currentVersion: 3,
    intent: { rawInput: 'Trek de deux jours', activities: ['hiking'], constraints: [] },
    participants: [
      { id: USER_A, displayName: 'Moi', role: 'owner' },
      {
        id: MEMBER_ID,
        displayName: 'Alice Martin',
        role: 'member',
        profileId: MEMBER_PROFILE_ID,
      },
    ],
    confidence: { score: 0.85, level: 'high', sampleCount: 9, method: 'a3-v1' },
    sections: {
      paceStrategies: planValue({
        segmentation: 'map_matched',
        profileSource: 'profile',
        segmentsCritical: segmentIds.slice(0, 2),
        stepSources: segmentIds.map((segmentId) => ({
          segmentId,
          paceSource: 'profile',
          provenance: 'measured',
          geometrySource: 'a13_segment_geometries',
        })),
        primary: { strategy: 'recommended', criticalSegmentIds: segmentIds.slice(0, 2) },
      }),
    },
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function makeBundle(plan = makePlan()): StoredAdventurePlan {
  const decision = adventureDecisionSchema.parse({
    id: 'a13f0006-6666-4666-8666-666666666666',
    planId: PLAN_ID,
    decisionType: 'location_share',
    proposal: 'Partager la position avec Alice Martin',
    requiresConfirmation: true,
    status: 'proposed',
    decidedBy: MEMBER_ID,
    createdAt: NOW,
  });
  return {
    plan,
    version: {
      version: 3,
      snapshot: plan,
      reason: 'route_real',
      generatedBy: 'a13',
      confidence: plan.confidence,
      createdAt: NOW,
    },
    decisions: [decision],
    candidates: [makePlan()],
    candidateComparison: null,
  };
}

function geometryFor(id: number, points = 4): SegmentGeometryRow {
  return {
    id,
    geojson: {
      type: 'LineString',
      coordinates: Array.from({ length: points }, (_, index) => [6 + index * 0.0001, 44 + index * 0.0001]),
    },
    surface: 'ground',
    sacScale: 'hiking',
    highway: 'path',
  };
}

const POI = {
  id: 42,
  name: 'Refuge du Col',
  category: 'refuge',
  description: null,
  lat: 44.0002,
  lng: 6.0002,
  tags: { tourism: 'alpine_hut' },
};

const TERRAIN = [
  {
    id: 'a13f0007-7777-4777-8777-777777777777',
    category: 'mud',
    severity: 'warning',
    passability: 'difficult',
    lat: 44.0001,
    lng: 6.0001,
    sourceType: 'user',
    status: 'active',
    presentCount: 1,
    goneCount: 0,
    unknownCount: 0,
    reportCount: 1,
    createdAt: NOW,
    distanceM: 120,
  },
] as unknown as TerrainLiveReport[];

interface PackClientOverrides {
  bundle?: StoredAdventurePlan | null;
  geometries?: (ids: number[]) => SegmentGeometryRow[];
  routePredictions?: Record<string, unknown>[];
  segmentPredictions?: (ids: number[]) => Record<string, unknown>[];
  pois?: typeof POI[];
  terrain?: TerrainLiveReport[];
}

function makePackClient(overrides: PackClientOverrides = {}) {
  const getPlanBundle = vi.fn(async () => (overrides.bundle === undefined ? makeBundle() : overrides.bundle));
  const getSegmentGeometries = vi.fn(async (ids: number[]) =>
    overrides.geometries ? overrides.geometries(ids) : ids.map((id) => geometryFor(id))
  );
  const listRoutePredictions = vi.fn(
    async () =>
      overrides.routePredictions ?? [
        { strategy: 'recommended', eta_p50: NOW, model_version: 'a13-v1' },
        { strategy: 'fast', eta_p50: NOW, model_version: 'a13-v1' },
      ]
  );
  const listSegmentPredictions = vi.fn(async (_userId: string, ids: number[]) =>
    overrides.segmentPredictions
      ? overrides.segmentPredictions(ids)
      : ids.map((segmentId) => ({ segment_id: segmentId, personal_difficulty: 70 }))
  );
  const listTrailPoisBbox = vi.fn(
    async (
      _bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
      _limit: number
    ) => overrides.pois ?? [POI]
  );
  const listTerrainReportsNear = vi.fn(async () => overrides.terrain ?? TERRAIN);

  const client: OfflinePackClient = {
    getPlanBundle,
    getSegmentGeometries,
    listRoutePredictions,
    listSegmentPredictions,
    listTrailPoisBbox,
    listTerrainReportsNear,
  };
  return {
    client,
    getPlanBundle,
    getSegmentGeometries,
    listRoutePredictions,
    listSegmentPredictions,
    listTrailPoisBbox,
    listTerrainReportsNear,
  };
}

function packRequest(overrides: Record<string, unknown> = {}) {
  return {
    adventureId: PLAN_ID,
    userId: USER_A,
    now: NOW,
    featureFlags: { terrain_live: true },
    ...overrides,
  };
}

describe('A13 — Pack offline complet et synchronisation réelle (TEST-A13-OFF)', () => {
  it('TEST-A13-OFF-01: pack complet réel, aucune donnée privée d’autres membres', async () => {
    const harness = makePackClient();

    const result = await buildOfflinePack(packRequest(), harness.client);

    expect(result.pack).not.toBeNull();
    const pack = result.pack!;
    expect(pack.version).toBe(1);
    expect(pack.adventureId).toBe(PLAN_ID);
    expect(pack.userId).toBe(USER_A);
    expect(pack.plan.title).toBe('Trek hors-ligne');
    expect(pack.planVersion?.version).toBe(3);
    expect(pack.segments.map((segment) => segment.id)).toEqual([101, 102]);
    expect(pack.predictions.route).toHaveLength(2);
    expect(pack.predictions.segments).toHaveLength(2);
    expect(pack.pois.map((poi) => poi.id)).toEqual([42]);
    expect(pack.terrain).toHaveLength(1);
    expect(pack.sizeBytes).toBeGreaterThan(0);
    expect(pack.capped).toBe(false);

    // Projection stricte : identités d'autres membres jamais exportées.
    expect(pack.plan.participants).toEqual([
      { id: USER_A, role: 'owner' },
      { id: MEMBER_ID, role: 'member' },
    ]);
    const serialized = JSON.stringify(pack);
    expect(serialized).not.toContain('Alice Martin');
    expect(serialized).not.toContain(MEMBER_PROFILE_ID);
    expect(serialized).not.toContain('decidedBy');
    expect(serialized).not.toContain('decisions');

    // Bornes et sources réelles, jamais extrapolées.
    expect(harness.listTrailPoisBbox).toHaveBeenCalledTimes(1);
    const [bbox, limit] = harness.listTrailPoisBbox.mock.calls[0];
    expect(bbox.minLat).toBeLessThanOrEqual(44);
    expect(bbox.maxLat).toBeGreaterThanOrEqual(44);
    expect(limit).toBeGreaterThan(0);
    expect(harness.listTerrainReportsNear).toHaveBeenCalledTimes(1);
  });

  it('TEST-A13-OFF-02: plan absent ⇒ pack nul, warning explicite, aucun appel superflu', async () => {
    const harness = makePackClient({ bundle: null });

    const result = await buildOfflinePack(packRequest(), harness.client);

    expect(result.pack).toBeNull();
    expect(result.warnings).toContain(OFFLINE_PACK_PLAN_NOT_FOUND_WARNING);
    expect(harness.getSegmentGeometries).not.toHaveBeenCalled();
    expect(harness.listRoutePredictions).not.toHaveBeenCalled();
    expect(harness.listTrailPoisBbox).not.toHaveBeenCalled();
    expect(harness.listTerrainReportsNear).not.toHaveBeenCalled();
  });

  it('TEST-A13-OFF-03: caches Dexie par utilisateur — six stores, ids préfixés par l’aventure', async () => {
    const harness = makePackClient();
    const pack = (await buildOfflinePack(packRequest(), harness.client)).pack!;

    const caches = packCacheEntries(pack);

    expect(caches.adventures).toHaveLength(1);
    expect(caches.routes).toHaveLength(2);
    expect(caches.segments).toHaveLength(2);
    expect(caches.predictions).toHaveLength(2);
    expect(caches.pois).toHaveLength(1);
    expect(caches.terrainEvents).toHaveLength(1);
    for (const entry of [
      ...caches.routes,
      ...caches.segments,
      ...caches.predictions,
      ...caches.pois,
      ...caches.terrainEvents,
    ]) {
      expect(entry.id.startsWith(`${PLAN_ID}:`)).toBe(true);
      expect(entry.updatedAt).toBe(pack.generatedAt);
    }
    expect(caches.adventures[0].payload).toMatchObject({ userId: USER_A });
    expect(shouldStoreOfflinePack(pack)).toBe(true);

    // La route GET restitue exactement le pack assemblé (même version).
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ pack }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const fetched = await offlinePackRequest(PLAN_ID, fetchImpl as unknown as typeof fetch);
    expect(fetched.adventureId).toBe(PLAN_ID);
    expect(fetched.version).toBe(pack.version);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/adventure/${PLAN_ID}/offline-pack`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('TEST-A13-OFF-04: idempotence SHA-256 — le rejeu ne réapplique jamais une opération', async () => {
    const operations = await Promise.all([
      createOfflineOperation({
        store: 'offline_sessions_queue',
        kind: 'hike_session',
        entityId: 'session-1',
        payload: { startedAt: '2026-09-11T08:00:00.000Z', distanceKm: 12.4 },
        userId: USER_A,
      }),
      createOfflineOperation({
        store: 'offline_reports_queue',
        kind: 'terrain_report',
        entityId: 'report-1',
        payload: { category: 'mud', lat: 44, lng: 6 },
        userId: USER_A,
      }),
      createOfflineOperation({
        store: 'offline_decisions_queue',
        kind: 'decision',
        entityId: 'a13f0008-8888-4888-8888-888888888888',
        payload: { planId: PLAN_ID, status: 'confirmed' },
        userId: USER_A,
      }),
    ]);
    for (const operation of operations) {
      expect(operation.idempotencyKey.split(':')[2]).toMatch(/^[0-9a-f]{64}$/);
    }

    const applied = new Map<string, OfflineSyncAppliedRecord>();
    const applySession = vi.fn(async () => ({ outcome: 'applied' as const, detail: 'session' }));
    const applyReport = vi.fn(async () => ({ outcome: 'applied' as const, detail: 'report' }));
    const applyDecision = vi.fn(async () => ({ outcome: 'applied' as const, detail: 'decision' }));
    const client: OfflineSyncClient = {
      findApplied: vi.fn(async (_userId, key) => applied.get(key) ?? null),
      markApplied: vi.fn(async (_userId, record) => {
        applied.set(record.idempotencyKey, record);
      }),
      applySession,
      applyReport,
      applyDecision,
    };

    const first = await syncOfflineBatch({ userId: USER_A, operations }, client);
    expect(first.applied).toBe(3);
    expect(first.duplicates).toBe(0);

    const second = await syncOfflineBatch({ userId: USER_A, operations }, client);
    expect(second.applied).toBe(0);
    expect(second.duplicates).toBe(3);
    expect(second.failed).toBe(0);
    expect(applySession).toHaveBeenCalledTimes(1);
    expect(applyReport).toHaveBeenCalledTimes(1);
    expect(applyDecision).toHaveBeenCalledTimes(1);
    expect(applied.size).toBe(3);
  });

  it('TEST-A13-OFF-05: reprise après erreur — transport factice en échec puis rejeu sans perte', async () => {
    const operation = await createOfflineOperation({
      store: 'offline_sessions_queue',
      kind: 'hike_session',
      entityId: 'session-2',
      payload: { startedAt: '2026-09-11T09:00:00.000Z', distanceKm: 5 },
      userId: USER_A,
    });
    const { storage, operations } = makeStorage([operation]);

    let failing = true;
    const fetchImpl = vi.fn(async () => {
      if (failing) return new Response('{}', { status: 503 });
      return new Response(
        JSON.stringify({
          results: [{ idempotencyKey: operation.idempotencyKey, status: 'applied' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    const transport = createAdventureSyncTransport({ fetchImpl });

    const failed = await syncPendingOperations({
      storage,
      transport,
      now: () => new Date(NOW),
      lock: undefined,
    });
    expect(failed.failed).toBe(1);
    expect(failed.succeeded).toBe(0);
    expect(operations.has(`offline_sessions_queue:${operation.id}`)).toBe(true);

    failing = false;
    const retried = await syncPendingOperations({
      storage,
      transport,
      now: () => new Date(Date.parse(NOW) + 2 * 60 * 60 * 1000),
      lock: undefined,
    });
    expect(retried.succeeded).toBe(1);
    expect(retried.failed).toBe(0);
    expect(operations.size).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('TEST-A13-OFF-06: cycle hors-ligne → reconnexion, ordre de priorité, zéro doublon', async () => {
    const operations = await Promise.all([
      await createOfflineOperation({
        store: 'offline_reports_queue',
        kind: 'terrain_report',
        entityId: 'r-offline',
        payload: { category: 'mud' },
        userId: USER_A,
        priority: 5,
      }),
      await createOfflineOperation({
        store: 'offline_sessions_queue',
        kind: 'hike_session',
        entityId: 's-offline',
        payload: { startedAt: NOW },
        userId: USER_A,
      }),
      await createOfflineOperation({
        store: 'offline_decisions_queue',
        kind: 'decision',
        entityId: 'd-offline',
        payload: { planId: PLAN_ID, status: 'confirmed' },
        userId: USER_A,
        priority: 2,
      }),
    ]);
    const { storage } = makeStorage(operations);

    // Hors-ligne : rien ne part, la file reste intacte.
    expect(await storage.loadPending()).toHaveLength(3);

    const sent: OfflineOperation[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { operations: OfflineOperation[] };
      sent.push(...body.operations);
      return new Response(
        JSON.stringify({
          results: body.operations.map((operation) => ({
            idempotencyKey: operation.idempotencyKey,
            status: 'applied',
          })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    const transport = createAdventureSyncTransport({ fetchImpl });

    const report = await syncPendingOperations({
      storage,
      transport,
      now: () => new Date(NOW),
      lock: undefined,
    });

    expect(report.succeeded).toBe(3);
    expect(report.failed).toBe(0);
    expect((await storage.loadPending()).length).toBe(0);
    expect(sent.map((operation) => operation.store)).toEqual([
      'offline_reports_queue',
      'offline_decisions_queue',
      'offline_sessions_queue',
    ]);
    expect(new Set(sent.map((operation) => operation.idempotencyKey)).size).toBe(3);
  });

  it('TEST-A13-OFF-07: purge par utilisateur — seule la base de l’utilisateur visé est supprimée', async () => {
    const deleteDatabase = vi.fn(async (_name: string) => {});
    await purgeOfflineData(USER_A, { deleteDatabase });

    const nameA = offlineDbNameForUser(USER_A);
    const nameB = offlineDbNameForUser(USER_B);
    expect(deleteDatabase).toHaveBeenCalledTimes(1);
    expect(deleteDatabase).toHaveBeenCalledWith(nameA);
    expect(deleteDatabase).not.toHaveBeenCalledWith(nameB);
    expect(nameA.startsWith(ADVENTURE_OFFLINE_DB_PREFIX)).toBe(true);
    expect(nameA).not.toBe(nameB);
  });

  it('TEST-A13-OFF-08: taille bornée — segments plafonnés, troncature explicite sous le plafond global', async () => {
    const ids = Array.from({ length: MAX_OFFLINE_PACK_SEGMENTS }, (_, index) => 1000 + index);
    const harness = makePackClient({
      bundle: makeBundle(makePlan(ids)),
      geometries: (requested) => requested.map((id) => geometryFor(id, 400)),
      segmentPredictions: (requested) =>
        requested.map((segmentId) => ({ segment_id: segmentId, personal_difficulty: 70 })),
      pois: [],
    });

    const result = await buildOfflinePack(packRequest(), harness.client);

    expect(result.pack).not.toBeNull();
    const pack = result.pack!;
    expect(pack.segments.length).toBeLessThanOrEqual(MAX_OFFLINE_PACK_SEGMENTS);
    expect(pack.segments.length).toBeLessThan(MAX_OFFLINE_PACK_SEGMENTS);
    expect(pack.sizeBytes).toBeLessThanOrEqual(MAX_OFFLINE_PACK_BYTES);
    expect(pack.capped).toBe(true);
    expect(pack.warnings).toContain(OFFLINE_PACK_TRUNCATED_WARNING);

    const caches = packCacheEntries(pack);
    expect(caches.segments).toHaveLength(pack.segments.length);
    expect(seekByteLength(pack)).toBeLessThanOrEqual(MAX_OFFLINE_PACK_BYTES);
  });
});

function seekByteLength(pack: unknown): number {
  return new TextEncoder().encode(JSON.stringify(pack)).length;
}

function makeStorage(initial: OfflineOperation[]) {
  const operations = new Map<string, OfflineOperation>();
  for (const operation of initial) {
    operations.set(`${operation.store}:${operation.id}`, operation);
  }
  const storage: SyncWorkerStorage = {
    loadPending: async () => [...operations.values()],
    removeOperations: async (entries: readonly OfflineStoreRef[]) => {
      let deleted = 0;
      for (const entry of entries) if (operations.delete(`${entry.store}:${entry.id}`)) deleted += 1;
      return deleted;
    },
    saveOperation: async (operation) => {
      operations.set(`${operation.store}:${operation.id}`, operation);
    },
    readMetadata: async () => undefined,
    writeMetadata: async () => {},
    clearMetadata: async () => {},
  };
  return { storage, operations };
}
