import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import {
  A3_FLAGS,
  currentAdventureFeatureFlags,
} from '@/features/adventure-intelligence/server/featureFlags';
import {
  PROFILE_BUILD_LIMIT,
  buildUserProfile,
  type ProfileBuildClient,
} from '@/features/adventure-intelligence/server/buildUserProfile';
import type { ProfileObservation } from '@/features/adventure-intelligence/domain/performanceProfile';

const USER_ID = '66666666-6666-4666-8666-666666666666';
const PROFILE_ID = '77777777-7777-4777-8777-777777777777';
const NOW = new Date().toISOString();

function observation(overrides: Partial<ProfileObservation> = {}): ProfileObservation {
  return {
    observedAt: NOW,
    distanceM: 5000,
    durationS: 3600,
    movingS: 3600,
    gainM: 0,
    lossM: 0,
    meanGradePct: 0,
    quality: 0.9,
    ...overrides,
  };
}

function makeClient(observations: ProfileObservation[] | Error) {
  const upserts: unknown[] = [];
  const callCounts = { profileVersionUpserts: 0 };
  const versionStore = new Map<string, unknown>();
  const calls: Array<{ userId: string; limit?: number }> = [];
  const client: ProfileBuildClient = {
    getObservations: vi.fn(async (userId: string, limit?: number) => {
      calls.push({ userId, limit });
      if (observations instanceof Error) throw observations;
      return observations;
    }),
    upsertProfile: vi.fn(async (row: unknown) => {
      upserts.push(row);
      return { id: PROFILE_ID };
    }),
    upsertProfileVersion: vi.fn(async (row: unknown) => {
      const version = row as { profile_id: string; model_version: string };
      callCounts.profileVersionUpserts += 1;
      versionStore.set(`${version.profile_id}:${version.model_version}`, row);
    }),
  };
  return { client, calls, upserts, callCounts, versions: versionStore };
}

describe('Flags A3 — TEST-A3-FLAG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST-A3-FLAG-01: lit les flags via RPC et complète les manquants à false', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { id: 'performance_profile_v2', enabled: true },
        { id: 'route_prediction_v2', enabled: false },
        { id: 'hub_all_enabled', enabled: true },
      ],
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc });

    const flags = await currentAdventureFeatureFlags();

    expect(rpc).toHaveBeenCalledWith('current_feature_flags');
    expect(flags).toEqual({
      performance_profile_v2: true,
      route_prediction_v2: false,
      collective_intelligence: false,
      terrain_live: false,
    });

    rpc.mockResolvedValue({ data: [{ id: 'performance_profile_v2', enabled: false }], error: null });
    const partial = await currentAdventureFeatureFlags();
    expect(partial).toEqual({
      performance_profile_v2: false,
      route_prediction_v2: false,
      collective_intelligence: false,
      terrain_live: false,
    });
  });

  it('TEST-A11-FLAG-FOR-01: avec userId, lit les flags via la RPC de cohortes', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { id: 'performance_profile_v2', enabled: true },
        { id: 'collective_intelligence', enabled: true },
        { id: 'terrain_live', enabled: false },
      ],
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc });

    const flags = await currentAdventureFeatureFlags(USER_ID);

    expect(rpc).toHaveBeenCalledWith('current_feature_flags_for', { p_user_id: USER_ID });
    expect(flags).toEqual({
      performance_profile_v2: true,
      route_prediction_v2: false,
      collective_intelligence: true,
      terrain_live: false,
    });
  });

  it('TEST-A3-FLAG-02: erreur ou exception ⇒ repli fail-safe tout désactivé', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc absente' } }),
    });
    await expect(currentAdventureFeatureFlags()).resolves.toEqual(A3_FLAGS);

    (createClient as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('supabase down'));
    await expect(currentAdventureFeatureFlags()).resolves.toEqual(A3_FLAGS);

    expect(A3_FLAGS).toEqual({
      performance_profile_v2: false,
      route_prediction_v2: false,
      collective_intelligence: false,
      terrain_live: false,
    });
  });
});

describe('Construction du profil serveur — TEST-A3-BUILD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST-A3-BUILD-01: profil construit, upsert profil puis snapshot versionné', async () => {
    const observations = Array.from({ length: 10 }, () => observation());
    const { client, calls, upserts, versions } = makeClient(observations);

    const result = await buildUserProfile(USER_ID, client);

    expect(result).toEqual({ status: 'built', sampleCount: 10 });
    expect(calls).toEqual([{ userId: USER_ID, limit: PROFILE_BUILD_LIMIT }]);

    expect(upserts).toHaveLength(1);
    const row = upserts[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      user_id: USER_ID,
      activity_type: 'hiking',
      model_version: 'a3-v1',
      flat_speed_kmh: 5,
      calibration_level: 'personalization',
      sample_count: 10,
    });
    expect(row.confidence).toMatchObject({ method: 'weighted_median_a3' });
    expect(row.grade_response).toMatchObject({ points: expect.any(Array) });
    expect(row.pause_model).toMatchObject({ pauseMinutesPerHour: expect.any(Number) });

    expect(versions.size).toBe(1);
    const version = versions.get(`${PROFILE_ID}:a3-v1`) as Record<string, unknown>;
    expect(version).toMatchObject({
      profile_id: PROFILE_ID,
      user_id: USER_ID,
      activity_type: 'hiking',
      model_version: 'a3-v1',
      sample_count: 10,
      reason: 'recompute',
    });
    const snapshot = version.snapshot as Record<string, unknown>;
    expect(snapshot.userId).toBe(USER_ID);
    expect(snapshot.modelVersion).toBe('a3-v1');
    expect(snapshot.personalized).toBe(true);

    // L'ordre est normatif : profil d'abord (id), version ensuite.
    const upsertOrder = (client.upsertProfile as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const versionOrder = (client.upsertProfileVersion as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(versionOrder);
  });

  it('TEST-A3-BUILD-02: profil vide ⇒ statut cold mais profil persistant', async () => {
    const { client, upserts, versions } = makeClient([]);

    const result = await buildUserProfile(USER_ID, client);

    expect(result).toEqual({ status: 'cold', sampleCount: 0 });
    const row = upserts[0] as Record<string, unknown>;
    expect(row.calibration_level).toBe('cold');
    expect(Number(row.flat_speed_kmh)).toBeGreaterThan(0);
    expect(versions.size).toBe(1);
    const version = versions.get(`${PROFILE_ID}:a3-v1`) as Record<string, unknown>;
    expect(version.model_version).toBe('a3-v1');
    expect((version.snapshot as Record<string, unknown>).personalized).toBe(false);
  });

  it('TEST-A3-BUILD-03: idempotence par modelVersion a3-v1 (recalculs successifs)', async () => {
    const observations = Array.from({ length: 10 }, () => observation());
    const { client, upserts, callCounts, versions } = makeClient(observations);

    await buildUserProfile(USER_ID, client);
    await buildUserProfile(USER_ID, client);

    expect(upserts).toHaveLength(2);
    for (const row of upserts) {
      expect((row as Record<string, unknown>).model_version).toBe('a3-v1');
      expect((row as Record<string, unknown>).user_id).toBe(USER_ID);
      expect((row as Record<string, unknown>).activity_type).toBe('hiking');
    }

    // Deux upserts appelés, mais sémantique idempotente : une seule ligne
    // stockée sur la clé (profile_id, model_version).
    expect(callCounts.profileVersionUpserts).toBe(2);
    expect(versions.size).toBe(1);
    const version = versions.get(`${PROFILE_ID}:a3-v1`) as Record<string, unknown>;
    expect(version).toMatchObject({
      profile_id: PROFILE_ID,
      model_version: 'a3-v1',
    });
  });

  it('TEST-A3-BUILD-04: une erreur de lecture remonte sans écriture partielle', async () => {
    const { client, upserts, versions } = makeClient(new Error('observations indisponibles'));

    await expect(buildUserProfile(USER_ID, client)).rejects.toThrow('observations indisponibles');
    expect(upserts).toHaveLength(0);
    expect(versions.size).toBe(0);
  });
});
