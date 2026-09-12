/**
 * Phase 6 — Pack hors-ligne versionné (TEST-PHASE6-PACK).
 *
 *   • TEST-PHASE6-PACK-01 : un pack v1 réel est accepté tel quel ;
 *   • TEST-PHASE6-PACK-02 : version inconnue refusée avec raison explicite ;
 *   • TEST-PHASE6-PACK-03 : champs racine manquants refusés, jamais réparés ;
 *   • TEST-PHASE6-PACK-04 : `offlinePackRequest` refuse un pack distant v2 ;
 *   • TEST-PHASE6-PACK-05 : `saveOfflinePack` n'écrit jamais un pack incompatible ;
 *   • TEST-PHASE6-PACK-06 : `readOfflinePackValidated` distingue absent/incompatible.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  OFFLINE_PACK_SUPPORTED_VERSIONS,
  OFFLINE_PACK_VERSION_UNSUPPORTED_PREFIX,
  isOfflinePackVersionSupported,
  validateOfflineAdventurePack,
  type OfflineAdventurePack,
} from '@/features/adventure-intelligence/domain/offlinePack';
import {
  offlinePackRequest,
  readOfflinePackValidated,
  saveOfflinePack,
} from '@/features/adventure-intelligence/offline/pack';
import { buildOfflinePack } from '@/features/adventure-intelligence/server/offlinePack';
import type { OfflinePackClient } from '@/features/adventure-intelligence/server/offlinePack';
import type { AdventureOfflineDb } from '@/features/adventure-intelligence/offline/db';

const USER_ID = 'a6f00001-0000-4000-8000-000000000001';
const PLAN_ID = 'a6f00002-0000-4000-8000-000000000002';
const NOW = '2026-09-12T10:00:00.000Z';

function minimalClient(planFound = true): OfflinePackClient {
  return {
    getPlanBundle: vi.fn(async () =>
      planFound
        ? {
            plan: {
              id: PLAN_ID,
              ownerId: USER_ID,
              title: 'Pack versionné',
              status: 'active',
              currentVersion: 1,
              confidence: null,
              intent: null,
              participants: [],
              dates: null,
              destinations: null,
              sections: {},
              monitoringRules: null,
              createdAt: NOW,
              updatedAt: NOW,
            },
            version: null,
            decisions: [],
            candidates: [],
            candidateComparison: null,
          }
        : null
    ),
    getSegmentGeometries: vi.fn(async () => []),
    listRoutePredictions: vi.fn(async () => []),
    listSegmentPredictions: vi.fn(async () => []),
    listTrailPoisBbox: vi.fn(async () => []),
    listTerrainReportsNear: vi.fn(async () => []),
  } as unknown as OfflinePackClient;
}

async function realPack(): Promise<OfflineAdventurePack> {
  const result = await buildOfflinePack(
    { adventureId: PLAN_ID, userId: USER_ID, now: NOW, featureFlags: { terrain_live: false } },
    minimalClient()
  );
  expect(result.pack).not.toBeNull();
  return result.pack!;
}

function fakeDb(header: unknown | undefined): AdventureOfflineDb {
  const table = () => ({
    get: async () => (header === undefined ? undefined : { id: PLAN_ID, payload: header, updatedAt: NOW }),
    where: () => ({ startsWith: () => ({ toArray: async () => [] }) }),
  });
  return {
    offline_adventures: table(),
    offline_routes: table(),
    offline_segments: table(),
    offline_predictions: table(),
    offline_pois: table(),
    offline_terrain_events: table(),
  } as unknown as AdventureOfflineDb;
}

describe('Phase 6 — pack hors-ligne versionné (TEST-PHASE6-PACK)', () => {
  it('TEST-PHASE6-PACK-01: pack v1 réel accepté, version listée supportée', async () => {
    const pack = await realPack();
    expect(OFFLINE_PACK_SUPPORTED_VERSIONS).toContain(1);
    expect(isOfflinePackVersionSupported(pack.version)).toBe(true);

    const validation = validateOfflineAdventurePack(pack);
    expect(validation.ok).toBe(true);
    if (validation.ok) expect(validation.pack.adventureId).toBe(PLAN_ID);
  });

  it('TEST-PHASE6-PACK-02: version inconnue refusée avec raison explicite', async () => {
    const pack = await realPack();
    const future = { ...pack, version: 2 } as unknown as OfflineAdventurePack;

    expect(isOfflinePackVersionSupported(2)).toBe(false);
    const validation = validateOfflineAdventurePack(future);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.error.startsWith(OFFLINE_PACK_VERSION_UNSUPPORTED_PREFIX)).toBe(true);
      expect(validation.error).toContain('2');
    }
  });

  it('TEST-PHASE6-PACK-03: champs racine manquants refusés, jamais réparés', async () => {
    const pack = await realPack();
    const cases: [Record<string, unknown>, string][] = [
      [{ ...pack, adventureId: '' }, 'adventureId_manquant'],
      [{ ...pack, userId: undefined }, 'userId_manquant'],
      [{ ...pack, generatedAt: 'pas-une-date' }, 'generatedAt_invalide'],
      [{ ...pack, sizeBytes: -1 }, 'sizeBytes_invalide'],
      [{ ...pack, capped: 'oui' }, 'capped_invalide'],
      [{ ...pack, plan: null }, 'plan_manquant'],
      [{ ...pack, predictions: { route: [], segments: 'non' } }, 'predictions_manquantes'],
      [{ ...pack, segments: undefined }, 'segments_manquants'],
      [{ ...pack, warnings: [1, 2] }, 'warnings_invalides'],
    ];
    for (const [candidate, error] of cases) {
      const validation = validateOfflineAdventurePack(candidate);
      expect(validation.ok).toBe(false);
      if (!validation.ok) expect(validation.error).toBe(error);
    }

    for (const notAnObject of [null, 'texte', 42, []]) {
      const validation = validateOfflineAdventurePack(notAnObject);
      expect(validation.ok).toBe(false);
      if (!validation.ok) expect(validation.error).toBe('pack_non_objet');
    }

    const emptyObject = validateOfflineAdventurePack({});
    expect(emptyObject.ok).toBe(false);
    if (!emptyObject.ok) {
      expect(emptyObject.error.startsWith(OFFLINE_PACK_VERSION_UNSUPPORTED_PREFIX)).toBe(true);
    }
  });

  it('TEST-PHASE6-PACK-04: offlinePackRequest refuse un pack distant v2', async () => {
    const pack = await realPack();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ pack: { ...pack, version: 2 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    await expect(
      offlinePackRequest(PLAN_ID, fetchImpl as unknown as typeof fetch)
    ).rejects.toThrow(/incompatible/);

    const okFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ pack }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const fetched = await offlinePackRequest(PLAN_ID, okFetch as unknown as typeof fetch);
    expect(fetched.version).toBe(1);
  });

  it('TEST-PHASE6-PACK-05: saveOfflinePack n’écrit jamais un pack incompatible', async () => {
    const pack = await realPack();
    const db = fakeDb(undefined);
    const validation = validateOfflineAdventurePack({ ...pack, version: 7 });
    expect(validation.ok).toBe(false);

    const result = await saveOfflinePack(db, { ...pack, version: 7 } as unknown as OfflineAdventurePack);
    expect(result.stored).toBe(false);
    expect(result.entries).toBe(0);
    expect(result.reason).toContain(OFFLINE_PACK_VERSION_UNSUPPORTED_PREFIX);
  });

  it('TEST-PHASE6-PACK-06: readOfflinePackValidated distingue absent et incompatible', async () => {
    const missing = await readOfflinePackValidated(fakeDb(undefined), PLAN_ID);
    expect(missing).toEqual({ status: 'missing', pack: null });

    const pack = await realPack();
    const header = {
      version: 2,
      adventureId: PLAN_ID,
      userId: USER_ID,
      generatedAt: NOW,
      sizeBytes: 1,
      capped: false,
      plan: pack.plan,
      planVersion: null,
      warnings: [],
    };
    const incompatible = await readOfflinePackValidated(fakeDb(header), PLAN_ID);
    expect(incompatible.status).toBe('incompatible');
    expect(incompatible.pack).toBeNull();
    expect(incompatible.error).toContain(OFFLINE_PACK_VERSION_UNSUPPORTED_PREFIX);
  });
});
