import { describe, it, expect, vi } from 'vitest';
import {
  runAdventureShadows,
  SHADOW_SAMPLE_USER_LIMIT,
  SHADOW_PASSAGES_PER_USER,
  type AdventureShadowClient,
  type ShadowPassageRow,
  type ShadowRunRow,
} from '@/features/adventure-intelligence/server/shadowRuns';
import { compareShadow } from '@/features/adventure-intelligence/domain/shadowMode';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';

const USER_A = 'a1010000-0000-4000-8000-000000000001';
const USER_B = 'a1010000-0000-4000-8000-000000000002';
const USER_C = 'a1010000-0000-4000-8000-000000000003';
const USER_D = 'a1010000-0000-4000-8000-000000000004';
const USER_E = 'a1010000-0000-4000-8000-000000000005';
const NOW = '2026-09-11T12:00:00.000Z';

function fastProfile(userId: string): PerformanceProfile {
  const curve = { points: [{ x: 0, value: 1 }], interpolate: 'linear' as const };
  return {
    userId,
    activityType: 'hiking',
    flatSpeedKmH: 6,
    ascentSpeedMPerHour: 600,
    descentSpeedMPerHour: 900,
    gradeResponse: curve,
    surfaceResponse: curve,
    fatigueCurve: { points: [{ x: 0, value: 1 }], decayPerHour: 0 },
    pauseModel: { pauseMinutesPerHour: 0, pauseMinutesPerAscentM: 0, minPauseMinutes: 0 },
    packResponse: curve,
    confidence: makeConfidence({ score: 0.8, sampleCount: 12, method: 'weighted_median_a3' }),
    sampleCount: 12,
    calibrationLevel: 'personalization',
    modelVersion: 'a3-v1',
    computedAt: NOW,
  };
}

function passage(userId: string, overrides: Partial<ShadowPassageRow> = {}): ShadowPassageRow {
  return {
    userId,
    segmentId: 10,
    distanceM: 1000,
    gainM: 100,
    lossM: 100,
    observedDurationS: 900,
    uturnDetected: false,
    offRoute: false,
    ...overrides,
  };
}

function makeClient(
  passages: ShadowPassageRow[],
  profiles: Record<string, PerformanceProfile | null> = {}
) {
  const inserted: ShadowRunRow[][] = [];
  const client: AdventureShadowClient = {
    listRecentPassages: vi.fn(async () => passages),
    getProfile: vi.fn(async (userId: string) => profiles[userId] ?? null),
    insertShadowRuns: vi.fn(async (rows: ShadowRunRow[]) => {
      inserted.push(rows);
    }),
  };
  return { client, inserted };
}

describe('A10 — Shadow runners (TEST-A10-SHADOW)', () => {
  it('TEST-A10-SHADOW-01: flags shadow éteints ⇒ aucun échantillon, aucune écriture', async () => {
    const { client, inserted } = makeClient([passage(USER_A)], { [USER_A]: fastProfile(USER_A) });

    const result = await runAdventureShadows(client, { flags: {}, now: NOW });

    expect(result).toEqual({ profile: 0, route_prediction: 0, collective: 0, terrain_auto: 0 });
    expect(client.listRecentPassages).not.toHaveBeenCalled();
    expect(client.getProfile).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it('TEST-A10-SHADOW-02: comparaison V1 standard vs V2 profil, latence et décision pending', async () => {
    const { client, inserted } = makeClient(
      [passage(USER_A), passage(USER_A, { segmentId: 11, distanceM: 1200 })],
      { [USER_A]: fastProfile(USER_A) }
    );

    const result = await runAdventureShadows(client, {
      flags: {
        performance_profile_v2_shadow: true,
        route_prediction_v2_shadow: true,
      },
      now: NOW,
    });

    expect(result.profile).toBe(1);
    expect(result.route_prediction).toBe(1);
    expect(inserted).toHaveLength(1);
    const rows = inserted[0];
    expect(rows).toHaveLength(2);

    const profileRow = rows.find((row) => row.kind === 'profile')!;
    expect(profileRow).toMatchObject({
      user_id: USER_A,
      primary_version: 'standard',
      shadow_version: 'a3-v1',
      decision: 'pending',
    });
    expect(profileRow.latency_ms).toBeGreaterThanOrEqual(0);
    const primaryPace = Number((profileRow.primary_value as { paceMinPerKm: number }).paceMinPerKm);
    const shadowPace = Number((profileRow.shadow_value as { paceMinPerKm: number }).paceMinPerKm);
    expect(shadowPace).toBeLessThan(primaryPace);
    expect(profileRow.delta_pct).toBe(
      compareShadow({ primary: primaryPace, shadow: shadowPace }).deltaPct
    );
    expect(profileRow.agreement).toBe(false);

    const routeRow = rows.find((row) => row.kind === 'route_prediction')!;
    const primaryDuration = Number(
      (routeRow.primary_value as { totalDurationP50Seconds: number }).totalDurationP50Seconds
    );
    const shadowDuration = Number(
      (routeRow.shadow_value as { totalDurationP50Seconds: number }).totalDurationP50Seconds
    );
    expect(shadowDuration).toBeLessThan(primaryDuration);
    expect(routeRow.delta_pct).not.toBeNull();
    expect(routeRow.confidence).toMatchObject({ shadow: { score: 0.8 } });
  });

  it('TEST-A10-SHADOW-03: échantillon borné au nombre d’utilisateurs demandé', async () => {
    const users = [USER_A, USER_B, USER_C, USER_D, USER_E];
    const passages = users.map((userId) => passage(userId));
    const profiles = Object.fromEntries(users.map((userId) => [userId, fastProfile(userId)]));
    const { client, inserted } = makeClient(passages, profiles);

    const result = await runAdventureShadows(client, {
      flags: { performance_profile_v2_shadow: true },
      limit: 2,
      now: NOW,
    });

    expect(SHADOW_SAMPLE_USER_LIMIT).toBeGreaterThanOrEqual(1);
    expect(client.listRecentPassages).toHaveBeenCalledWith(2 * SHADOW_PASSAGES_PER_USER);
    expect(client.getProfile).toHaveBeenCalledTimes(2);
    expect(result.profile).toBe(2);
    const userIds = new Set(inserted[0].map((row) => row.user_id));
    expect(userIds.size).toBe(2);
  });

  it('TEST-A10-SHADOW-04: terrain auto journalisé (kind terrain_auto, jamais publié)', async () => {
    const passages = [
      passage(USER_A, {
        segmentId: 99,
        distanceM: 100,
        gainM: 10,
        lossM: 10,
        observedDurationS: 120,
        uturnDetected: true,
      }),
      passage(USER_B, {
        segmentId: 99,
        distanceM: 100,
        gainM: 10,
        lossM: 10,
        observedDurationS: 120,
        uturnDetected: true,
      }),
      passage(USER_C, {
        segmentId: 99,
        distanceM: 100,
        gainM: 10,
        lossM: 10,
        observedDurationS: 120,
        uturnDetected: true,
      }),
    ];
    const { client, inserted } = makeClient(passages);

    const result = await runAdventureShadows(client, {
      flags: { terrain_auto_detection_shadow: true },
      now: NOW,
    });

    expect(result.terrain_auto).toBe(1);
    expect(inserted).toHaveLength(1);
    const rows = inserted[0];
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.kind).toBe('terrain_auto');
    expect(row.user_id).toBeNull();
    expect(row.decision).toBe('pending');
    expect(row.delta_pct).toBeNull();
    expect(row.agreement).toBe(false);
    expect(row.shadow_value).toMatchObject({
      segmentId: 99,
      sourceType: 'auto',
      shadow: true,
    });
    expect(row.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('TEST-A10-SHADOW-04b: profil absent ⇒ aucune comparaison inventée', async () => {
    const { client, inserted } = makeClient([passage(USER_A)], {});

    const result = await runAdventureShadows(client, {
      flags: {
        performance_profile_v2_shadow: true,
        route_prediction_v2_shadow: true,
        collective_intelligence_shadow: true,
      },
      now: NOW,
    });

    expect(result).toEqual({ profile: 0, route_prediction: 0, collective: 0, terrain_auto: 0 });
    expect(inserted).toHaveLength(0);
  });
});
