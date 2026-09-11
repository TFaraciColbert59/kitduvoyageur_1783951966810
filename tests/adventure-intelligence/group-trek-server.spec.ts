/**
 * A13 (S3) — Serveur groupe/trek : résolution crew/profils consentis, étapes
 * réelles vs repli blueprint explicite, persistance versionnée et relectures.
 *
 *   • TEST-A13-GROUP-08 : profils lus uniquement avec consentement, repli
 *     standard sinon ; aucune identité dans le payload de version.
 *   • TEST-A13-GROUP-09 : accès crew (non-membre ⇒ refus), crew absent ⇒ 400
 *     explicite, étapes indisponibles ⇒ 409 explicite.
 *   • TEST-A13-TREK-07 : étapes trip_steps prioritaires, repli blueprint déclaré,
 *     simulation persistée puis relue.
 *   • TEST-A13-GROUP-10 : relectures validées (snapshot corrompu ⇒ null).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeAndPersistGroupPlan,
  computeAndPersistTrekPlan,
  readLatestGroupPlan,
  readLatestTrekPlan,
  type GroupTrekDataSource,
} from '@/features/adventure-intelligence/server/groupTrek';
import type { AdventurePlan } from '@/features/adventure-intelligence/domain/adventurePlan';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';

const NOW = '2026-09-11T12:00:00.000Z';
const PLAN_ID = 'a1330000-0000-4000-8000-0000000000e1';
const OWNER_ID = 'a1330000-0000-4000-8000-0000000000e2';
const MEMBER_ID = 'a1330000-0000-4000-8000-0000000000e3';
const OTHER_ID = 'a1330000-0000-4000-8000-0000000000e4';
const CREW_ID = 'a1330000-0000-4000-8000-0000000000e5';
const TRIP_ID = 'a1330000-0000-4000-8000-0000000000e6';

function planFixture(overrides: Partial<AdventurePlan> = {}): AdventurePlan {
  return {
    id: PLAN_ID,
    ownerId: OWNER_ID,
    title: 'Plan S3',
    status: 'draft',
    currentVersion: 1,
    intent: { rawInput: 'test', activities: [], constraints: [] },
    participants: [],
    dates: { flexible: true },
    destinations: [],
    sections: {
      transport: null,
      localMobility: null,
      accommodations: null,
      dailyStages: {
        value: { days: 2, stagesCount: 2, phases: [] },
        confidence: makeConfidence({ score: 0.5, sampleCount: 0, method: 'test' }),
        provenance: [{ source: 'estimated' }],
        assumptions: [],
        warnings: [],
        impacts: [],
        computedAt: NOW,
      },
      activityRoutes: null,
      terrainAnalysis: {
        value: { totalDistanceKm: 24, totalGainM: 1400, totalLossM: 1400 },
        confidence: makeConfidence({ score: 0.5, sampleCount: 0, method: 'test' }),
        provenance: [{ source: 'estimated' }],
        assumptions: [],
        warnings: [],
        impacts: [],
        computedAt: NOW,
      },
      personalDifficulty: null,
      groupDifficulty: null,
      paceStrategies: null,
      foodAndWater: null,
      gearPlan: null,
      budget: null,
      bookings: null,
      documents: null,
      regulations: null,
      safetyPlan: null,
      offlinePackage: null,
      liveConditions: null,
      alternatives: null,
    },
    confidence: makeConfidence({ score: 0.5, sampleCount: 0, method: 'test' }),
    monitoringRules: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

interface FakeCalls {
  consent: string[];
  profiles: string[];
  appended: Record<string, unknown>[];
}

function fakeSource(
  overrides: Partial<GroupTrekDataSource> = {},
  calls: FakeCalls = { consent: [], profiles: [], appended: [] }
): { source: GroupTrekDataSource; calls: FakeCalls } {
  const source: GroupTrekDataSource = {
    getCrewById: vi.fn(async () => ({
      id: CREW_ID,
      createdBy: OWNER_ID,
      visibility: 'private',
    })),
    getCrewIdForTrip: vi.fn(async () => CREW_ID),
    listActiveCrewMembers: vi.fn(async () => [
      { userId: OWNER_ID, role: 'owner' },
      { userId: MEMBER_ID, role: 'member' },
    ]),
    getTripStages: vi.fn(async () => []),
    getDisplayNames: vi.fn(async () => ({ [OWNER_ID]: 'Alice', [MEMBER_ID]: 'Bob' })),
    hasActiveConsent: vi.fn(async (userId: string) => {
      calls.consent.push(userId);
      return userId === MEMBER_ID;
    }),
    getProfileSpeeds: vi.fn(async (userId: string) => {
      calls.profiles.push(userId);
      return userId === MEMBER_ID
        ? { flatSpeedKmH: 5, ascentSpeedMPerHour: 400, descentSpeedMPerHour: 600 }
        : null;
    }),
    appendVersion: vi.fn(async (payload: { version: Record<string, unknown> }) => {
      calls.appended.push(payload.version);
      return 2;
    }),
    readLatestSnapshot: vi.fn(async () => null),
    ...overrides,
  };
  return { source, calls };
}

describe('A13 (S3) — calcul et persistance groupe/trek côté serveur', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TEST-A13-GROUP-08: consentement gate les profils, repli standard sinon', async () => {
    const { source, calls } = fakeSource();

    const result = await computeAndPersistGroupPlan(source, OWNER_ID, planFixture(), {
      crewId: CREW_ID,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe(2);
    expect(result.meta.memberCount).toBe(2);
    expect(result.meta.stagesSource).toBe('blueprint_uniform');
    expect(calls.consent).toEqual([OWNER_ID, MEMBER_ID]);
    expect(calls.profiles).toEqual([MEMBER_ID]);

    // Le membre consentant pèse sur l'allure avec ses vitesses réelles ; le
    // propriétaire sans consentement est au repli standard.
    expect(result.summary.memberCount).toBe(2);
    expect(result.summary.groupPaceKmH).toBeGreaterThan(0);

    const payload = calls.appended[0];
    expect(payload.reason).toBe('group-computed');
    const snapshot = payload.snapshot as Record<string, unknown>;
    expect(snapshot.groupPlan).toEqual(result.summary);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('Alice');
    expect(serialized).not.toContain('Bob');
    // L'identité du propriétaire est portée par le plan lui-même ; aucun autre
    // membre ne doit apparaître dans le payload.
    expect(serialized).not.toContain(MEMBER_ID);
    expect(serialized).not.toContain('memberPacesKmH');
  });

  it('TEST-A13-GROUP-09: accès crew strict, crew absent et étapes manquantes explicites', async () => {
    const outsider = fakeSource({
      listActiveCrewMembers: vi.fn(async () => [{ userId: MEMBER_ID, role: 'member' }]),
    });
    const forbidden = await computeAndPersistGroupPlan(outsider.source, OTHER_ID, planFixture(), {
      crewId: CREW_ID,
      now: NOW,
    });
    expect(forbidden).toEqual({ ok: false, reason: 'forbidden' });
    expect(outsider.source.appendVersion).not.toHaveBeenCalled();

    const noCrew = fakeSource({ getCrewIdForTrip: vi.fn(async () => null) });
    const crewRequired = await computeAndPersistGroupPlan(noCrew.source, OWNER_ID, planFixture(), {
      now: NOW,
    });
    expect(crewRequired).toEqual({ ok: false, reason: 'crew_required' });

    const unknownCrew = fakeSource({ getCrewById: vi.fn(async () => null) });
    expect(
      await computeAndPersistGroupPlan(unknownCrew.source, OWNER_ID, planFixture(), {
        crewId: CREW_ID,
        now: NOW,
      })
    ).toEqual({ ok: false, reason: 'forbidden' });

    const noStages = fakeSource();
    const emptyPlan = planFixture({
      sections: {
        ...planFixture().sections,
        dailyStages: null,
        terrainAnalysis: null,
        activityRoutes: null,
      },
    });
    expect(
      await computeAndPersistGroupPlan(noStages.source, OWNER_ID, emptyPlan, {
        crewId: CREW_ID,
        now: NOW,
      })
    ).toEqual({ ok: false, reason: 'stages_unavailable' });
  });

  it('TEST-A13-TREK-07: trip_steps prioritaires, repli blueprint déclaré, persistance', async () => {
    const { source, calls } = fakeSource({
      getTripStages: vi.fn(async () => [
        { dayNumber: 1, distanceM: 15000, gainM: 900, lossM: 500 },
        { dayNumber: 2, distanceM: 9000, gainM: 500, lossM: 900 },
      ]),
    });

    const result = await computeAndPersistTrekPlan(
      source,
      planFixture({ tripId: TRIP_ID }),
      { packWeightKg: null, now: NOW }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.stagesSource).toBe('trip_steps');
    expect(result.meta.dayCount).toBe(2);
    expect(result.result.daily).toHaveLength(2);
    expect(calls.appended[0].reason).toBe('trek-computed');

    const fallback = await computeAndPersistTrekPlan(fakeSource().source, planFixture(), {
      now: NOW,
    });
    expect(fallback.ok).toBe(true);
    if (fallback.ok) {
      expect(fallback.meta.stagesSource).toBe('blueprint_uniform');
    }

    const missing = await computeAndPersistTrekPlan(
      fakeSource().source,
      planFixture({
        sections: {
          ...planFixture().sections,
          dailyStages: null,
          terrainAnalysis: null,
          activityRoutes: null,
        },
      }),
      { now: NOW }
    );
    expect(missing).toEqual({ ok: false, reason: 'stages_unavailable' });
  });

  it('TEST-A13-GROUP-10: relectures validées, snapshot corrompu ⇒ null', async () => {
    const { source } = fakeSource({
      readLatestSnapshot: vi.fn(async () => ({
        version: 4,
        snapshot: {
          groupPlan: {
            groupPaceKmH: 3.5,
            groupDifficulty: 40,
            limitingReason: null,
            separationRisk: { level: 'low', reasons: [] },
            memberCount: 2,
            pauseEveryMinutes: 60,
            gearRedistribution: { transfers: 0, totalWeightKg: 0, maxPerReceiverKg: 5 },
            difficultyRange: { min: 30, max: 40 },
          },
          groupPlanMeta: {
            stagesSource: 'trip_steps',
            strategy: 'recommended',
            crewId: null,
            tripId: null,
            memberCount: 2,
            modelVersion: 'a13-group-v1',
            computedAt: NOW,
          },
        },
      })),
    });

    const group = await readLatestGroupPlan(source, PLAN_ID);
    expect(group?.version).toBe(4);
    expect(group?.summary.memberCount).toBe(2);

    const corrupted = fakeSource({
      readLatestSnapshot: vi.fn(async () => ({
        version: 4,
        snapshot: { groupPlan: { groupPaceKmH: 'corrompu' } },
      })),
    });
    expect(await readLatestGroupPlan(corrupted.source, PLAN_ID)).toBeNull();

    const trek = fakeSource({
      readLatestSnapshot: vi.fn(async () => ({
        version: 5,
        snapshot: {
          trekPlan: { daily: [], worstDay: 0, totalDriftRisk: 0 },
          trekPlanMeta: {
            stagesSource: 'blueprint_uniform',
            dayCount: 0,
            modelVersion: 'a13-trek-v1',
            computedAt: NOW,
          },
        },
      })),
    });
    const trekPayload = await readLatestTrekPlan(trek.source, PLAN_ID);
    expect(trekPayload?.version).toBe(5);
    expect(trekPayload?.result.daily).toEqual([]);

    const noSnapshot = fakeSource({ readLatestSnapshot: vi.fn(async () => null) });
    expect(await readLatestGroupPlan(noSnapshot.source, PLAN_ID)).toBeNull();
    expect(await readLatestTrekPlan(noSnapshot.source, PLAN_ID)).toBeNull();
  });
});
