/**
 * A13 (S3) — Produit groupe + trek persistés dans le snapshot de version.
 *
 *   • TEST-A13-GROUP-01 : projection publique UI sans identité ni vitesse privée
 *     (membres, ids, vitesse individuelle, limitations jamais exposés).
 *   • TEST-A13-GROUP-02 : payload de version `group-computed` (snapshot public,
 *     métadonnées de source) — aucune donnée privée persistée.
 *   • TEST-A13-GROUP-03 : relance idempotente/privacy sur snapshot existant
 *     (les données privées d'un snapshot V1 ne ressortent jamais par la lecture).
 *   • TEST-A13-TREK-01 : étapes blueprint réparties explicitement (jamais
 *     silencieuses) ; sans agrégat exploitable ⇒ aucune étape inventée.
 *   • TEST-A13-TREK-02 : payload de version `trek-computed` + relecture validée.
 *   • TEST-A13-TREK-03 : lecture d'un snapshot corrompu ⇒ `null` (jamais de
 *     résultat partiel présenté comme valide).
 */
import { describe, it, expect } from 'vitest';
import {
  buildGroupPlan,
  MAX_GEAR_TRANSFER_KG,
  projectGroupPlanPublic,
  type GroupMemberInput,
  type GroupSegment,
} from '@/features/adventure-intelligence/domain/groupIntelligence';
import { simulateMultiDayTrek } from '@/features/adventure-intelligence/domain/multiDayTrek';
import {
  buildGroupPlanVersion,
  buildTrekPlanVersion,
  groupPlanPayloadFromSnapshot,
  planStagesFromPlan,
  stagesFromAggregates,
  summarizeGroupPlanPublic,
  trekPlanPayloadFromSnapshot,
  trekDaysFromStages,
  GROUP_PLAN_MODEL_VERSION,
  TREK_PLAN_MODEL_VERSION,
} from '@/features/adventure-intelligence/domain/planGroupTrek';
import type { AdventurePlan, PlanValue } from '@/features/adventure-intelligence/domain/adventurePlan';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';

const NOW = '2026-09-11T12:00:00.000Z';
const PLAN_ID = 'a1330000-0000-4000-8000-0000000000f1';
const OWNER_ID = 'a1330000-0000-4000-8000-0000000000f2';

function planValue<T>(value: T): PlanValue<T> {
  return {
    value,
    confidence: makeConfidence({ score: 0.6, sampleCount: 0, method: 'a13-test' }),
    provenance: [{ source: 'computed', sourceRef: 'a13:test' }],
    assumptions: [],
    warnings: [],
    impacts: [],
    computedAt: NOW,
  };
}

function basePlan(overrides: Partial<AdventurePlan> = {}): AdventurePlan {
  return {
    id: PLAN_ID,
    ownerId: OWNER_ID,
    title: 'Aventure — Vercors',
    status: 'draft',
    currentVersion: 1,
    intent: { rawInput: 'Trek de trois jours', activities: ['hiking'], constraints: [] },
    participants: [],
    dates: { start: '2026-09-20T08:00:00.000Z', end: '2026-09-22T18:00:00.000Z', flexible: false },
    destinations: [{ label: 'Vercors', countryCode: 'FR' }],
    sections: {
      transport: null,
      localMobility: null,
      accommodations: null,
      dailyStages: planValue({ days: 3, stagesCount: 3, phases: [] }),
      activityRoutes: planValue({
        stagesCount: 3,
        totalDistanceKm: 36,
        totalGainM: 2100,
        totalLossM: 2100,
        difficulty: 'moderate',
      }),
      terrainAnalysis: planValue({
        totalDistanceKm: 36,
        totalGainM: 2100,
        totalLossM: 2100,
        difficulty: 'moderate',
      }),
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
    confidence: makeConfidence({ score: 0.5, sampleCount: 0, method: 'a13-test' }),
    monitoringRules: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const SEGMENTS: GroupSegment[] = [
  { segmentId: 1, distanceM: 12000, gainM: 700, lossM: 700 },
  { segmentId: 2, distanceM: 12000, gainM: 700, lossM: 700 },
  { segmentId: 3, distanceM: 12000, gainM: 700, lossM: 700 },
];

function members(): GroupMemberInput[] {
  return [
    {
      memberId: 'user-alice-secret',
      displayName: 'Alice Martin',
      role: 'owner',
      flatSpeedKmH: 4.5,
      ascentSpeedMPerHour: 350,
      descentSpeedMPerHour: 550,
      packWeightKg: 7,
      maxCarryKg: 12,
      experienceLevel: 'advanced',
      limitations: ['asthme-secret'],
    },
    {
      memberId: 'user-bob-secret',
      displayName: 'Bob Durand',
      role: 'member',
      flatSpeedKmH: 3.2,
      ascentSpeedMPerHour: 260,
      descentSpeedMPerHour: 380,
      packWeightKg: 13,
      maxCarryKg: 9,
      experienceLevel: 'beginner',
      isChild: true,
    },
  ];
}

function fullGroupPlan() {
  return buildGroupPlan(members(), SEGMENTS, { strategy: 'recommended' });
}

describe('A13 (S3) — projection publique du groupe', () => {
  it('TEST-A13-GROUP-01: résumé public sans identité, ni vitesse individuelle, ni privé', () => {
    const summary = summarizeGroupPlanPublic(fullGroupPlan());
    const serialized = JSON.stringify(summary);

    for (const secret of [
      'Alice',
      'Bob',
      'user-alice-secret',
      'user-bob-secret',
      'displayName',
      'memberId',
      'memberPacesKmH',
      'perMemberDifficulty',
      'fromMemberId',
      'toMemberId',
      'limitations',
      'asthme-secret',
      'flatSpeedKmH',
    ]) {
      expect(serialized).not.toContain(secret);
    }

    const publicBase = projectGroupPlanPublic(fullGroupPlan());
    expect(summary).toMatchObject({
      groupPaceKmH: publicBase.groupPaceKmH,
      groupDifficulty: publicBase.groupDifficulty,
      limitingReason: publicBase.limitingReason,
      separationRisk: publicBase.separationRisk,
      memberCount: 2,
    });
    expect(summary?.difficultyRange?.min ?? 0).toBeLessThanOrEqual(
      summary?.difficultyRange?.max ?? 0
    );
    expect(summary.gearRedistribution.transfers).toBeGreaterThanOrEqual(1);
    expect(summary.gearRedistribution.totalWeightKg).toBeGreaterThan(0);
    expect(summary.gearRedistribution.maxPerReceiverKg).toBe(MAX_GEAR_TRANSFER_KG);
  });

  it('TEST-A13-GROUP-02: version group-computed persistée sans donnée privée', () => {
    const plan = basePlan();
    const summary = summarizeGroupPlanPublic(fullGroupPlan());

    const version = buildGroupPlanVersion({
      plan,
      summary,
      stagesSource: 'blueprint_uniform',
      strategy: 'recommended',
      crewId: 'a1330000-0000-4000-8000-0000000000f3',
      tripId: null,
      memberCount: summary.memberCount,
      now: NOW,
    });

    expect(version.reason).toBe('group-computed');
    expect(version.generated_by).toBe('a13-group');
    expect(version.version).toBe(plan.currentVersion + 1);

    const snapshot = version.snapshot as Record<string, unknown>;
    expect(snapshot.currentVersion).toBe(2);
    expect(snapshot.updatedAt).toBe(NOW);
    expect(snapshot.groupPlan).toEqual(summary);
    expect(snapshot.groupPlanMeta).toMatchObject({
      stagesSource: 'blueprint_uniform',
      strategy: 'recommended',
      modelVersion: GROUP_PLAN_MODEL_VERSION,
      computedAt: NOW,
      memberCount: 2,
    });

    const serialized = JSON.stringify(version);
    expect(serialized).not.toContain('Alice');
    expect(serialized).not.toContain('user-alice-secret');
    expect(serialized).not.toContain('asthme-secret');
  });

  it('TEST-A13-GROUP-03: relecture d’un snapshot ne laisse jamais fuiter le privé', () => {
    const plan = basePlan();
    const summary = summarizeGroupPlanPublic(fullGroupPlan());
    const version = buildGroupPlanVersion({
      plan,
      summary,
      stagesSource: 'trip_steps',
      strategy: 'comfort',
      crewId: null,
      tripId: 'a1330000-0000-4000-8000-0000000000f4',
      memberCount: summary.memberCount,
      now: NOW,
    });

    const payload = groupPlanPayloadFromSnapshot({
      ...version.snapshot,
      secretMemberPaces: [{ memberId: 'user-alice-secret', paceKmH: 4.5 }],
      secretNames: ['Alice Martin'],
    });

    expect(payload).not.toBeNull();
    expect(payload?.summary).toEqual(summary);
    expect(payload?.meta.stagesSource).toBe('trip_steps');
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('secretMemberPaces');
    expect(serialized).not.toContain('Alice Martin');
    expect(serialized).not.toContain('user-alice-secret');
  });
});

describe('A13 (S3) — étapes et version trek', () => {
  it('TEST-A13-TREK-01: étapes blueprint explicites, jamais inventées', () => {
    const plan = basePlan();
    const fromPlan = planStagesFromPlan(plan);

    expect(fromPlan.source).toBe('blueprint_uniform');
    expect(fromPlan.stages).toHaveLength(3);
    const totalDistanceM = fromPlan.stages.reduce((sum, stage) => sum + stage.distanceM, 0);
    expect(totalDistanceM).toBeCloseTo(36000, 3);
    for (const stage of fromPlan.stages) {
      expect(stage.dayNumber).toBeGreaterThanOrEqual(1);
      expect(stage.distanceM).toBeGreaterThan(0);
    }

    expect(planStagesFromPlan(basePlan({ sections: { ...basePlan().sections, dailyStages: null, activityRoutes: null, terrainAnalysis: null } })).stages).toEqual([]);
    expect(stagesFromAggregates({ days: 3, totalDistanceKm: 0, totalGainM: 0, totalLossM: 0 })).toEqual([]);

    const days = trekDaysFromStages(fromPlan.stages);
    expect(days).toHaveLength(3);
    const result = simulateMultiDayTrek(days);
    expect(result.daily).toHaveLength(3);
    expect(result.worstDay).toBeGreaterThanOrEqual(1);
  });

  it('TEST-A13-TREK-02: version trek-computed validée à la relecture', () => {
    const plan = basePlan();
    const stages = planStagesFromPlan(plan);
    const result = simulateMultiDayTrek(trekDaysFromStages(stages.stages));

    const version = buildTrekPlanVersion({
      plan,
      result,
      stagesSource: stages.source,
      dayCount: stages.stages.length,
      now: NOW,
    });

    expect(version.reason).toBe('trek-computed');
    expect(version.generated_by).toBe('a13-trek');
    expect(version.version).toBe(2);

    const snapshot = version.snapshot as Record<string, unknown>;
    expect(snapshot.trekPlan).toEqual(result);
    expect(snapshot.trekPlanMeta).toMatchObject({
      stagesSource: 'blueprint_uniform',
      dayCount: 3,
      modelVersion: TREK_PLAN_MODEL_VERSION,
      computedAt: NOW,
    });

    const payload = trekPlanPayloadFromSnapshot(version.snapshot);
    expect(payload?.result.daily).toHaveLength(3);
    expect(payload?.meta.dayCount).toBe(3);
  });

  it('TEST-A13-TREK-03: snapshot corrompu ⇒ aucune donnée partielle', () => {
    expect(trekPlanPayloadFromSnapshot(null)).toBeNull();
    expect(trekPlanPayloadFromSnapshot({})).toBeNull();
    expect(
      trekPlanPayloadFromSnapshot({ trekPlan: { daily: 'corrompu' } })
    ).toBeNull();
    expect(
      groupPlanPayloadFromSnapshot({ groupPlan: { groupPaceKmH: 'x' } })
    ).toBeNull();
  });
});
