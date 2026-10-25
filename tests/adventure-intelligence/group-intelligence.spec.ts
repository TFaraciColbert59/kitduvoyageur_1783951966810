import { describe, it, expect } from 'vitest';
import {
  MAX_GEAR_TRANSFER_KG,
  buildGroupPlan,
  projectGroupPlanPublic,
  type GroupMemberInput,
  type GroupSegment,
} from '@/features/adventure-intelligence/domain/groupIntelligence';

const SEGMENTS: GroupSegment[] = [
  { segmentId: 1, distanceM: 5000, gainM: 300, lossM: 100 },
  { segmentId: 2, distanceM: 5000, gainM: 100, lossM: 500 },
];

const FLAT_SEGMENTS: GroupSegment[] = [
  { segmentId: 1, distanceM: 5000, gainM: 0, lossM: 0 },
  { segmentId: 2, distanceM: 5000, gainM: 0, lossM: 0 },
];

function member(overrides: Partial<GroupMemberInput> & { memberId: string }): GroupMemberInput {
  return {
    displayName: overrides.memberId,
    role: 'member',
    flatSpeedKmH: 4,
    ascentSpeedMPerHour: 300,
    descentSpeedMPerHour: 500,
    packWeightKg: null,
    maxCarryKg: null,
    experienceLevel: 'intermediate',
    ...overrides,
  };
}

describe('A8 — intelligence de groupe (TEST-A8-GRP)', () => {
  it('TEST-A8-GRP-01: le groupe est dimensionné par le membre le plus lent, jamais par la moyenne', () => {
    const fast = member({ memberId: 'fast', flatSpeedKmH: 5.5 });
    const slow = member({ memberId: 'slow', flatSpeedKmH: 3 });
    const medium = member({ memberId: 'medium', flatSpeedKmH: 4.5 });

    const plan = buildGroupPlan([fast, slow, medium], SEGMENTS);
    const paces = plan.memberPacesKmH.map((entry) => entry.paceKmH);
    const slowPace = plan.memberPacesKmH.find((entry) => entry.memberId === 'slow')?.paceKmH;
    const average = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;

    expect(plan.limitingMemberId).toBe('slow');
    expect(plan.groupPaceKmH).toBeCloseTo(slowPace as number, 6);
    expect(plan.groupPaceKmH).toBeLessThan(average);
    expect(plan.limitingReason).toBeTruthy();
    expect(plan.limitingReason).not.toContain('slow');
  });

  it('TEST-A8-GRP-02: la difficulté par membre est calculée et la difficulté groupe est la plus élevée', () => {
    const plan = buildGroupPlan(
      [
        member({ memberId: 'a', flatSpeedKmH: 5 }),
        member({ memberId: 'b', flatSpeedKmH: 3.5 }),
        member({ memberId: 'c', flatSpeedKmH: 4.2 }),
      ],
      SEGMENTS
    );

    expect(plan.perMemberDifficulty).toHaveLength(3);
    for (const entry of plan.perMemberDifficulty) {
      expect(entry.difficulty).toBeGreaterThanOrEqual(0);
      expect(entry.difficulty).toBeLessThanOrEqual(100);
    }

    const difficulties = plan.perMemberDifficulty.map((entry) => entry.difficulty);
    expect(plan.groupDifficulty).toBe(Math.max(...difficulties));
    for (const entry of plan.perMemberDifficulty) {
      expect(plan.groupDifficulty).toBeGreaterThanOrEqual(entry.difficulty);
    }
  });

  it('TEST-A8-GRP-03: un enfant ralentit l’allure collective et devient le membre dimensionnant', () => {
    const adult = member({ memberId: 'adult', flatSpeedKmH: 4.5 });
    const child = member({ memberId: 'child', flatSpeedKmH: 4.5, isChild: true });

    const withoutChild = buildGroupPlan([adult], SEGMENTS);
    const withChild = buildGroupPlan([adult, child], SEGMENTS);

    expect(withChild.limitingMemberId).toBe('child');
    expect(withChild.groupPaceKmH).toBeLessThan(withoutChild.groupPaceKmH);
    expect(withChild.limitingReason?.toLowerCase()).toContain('enfant');
    expect(withChild.limitingReason).not.toContain('child');
  });

  it('TEST-A8-GRP-04: le risque de séparation dépend de l’écart d’allure et de la présence d’un enfant', () => {
    const even = buildGroupPlan(
      [
        member({ memberId: 'x', flatSpeedKmH: 4 }),
        member({ memberId: 'y', flatSpeedKmH: 4 }),
      ],
      FLAT_SEGMENTS
    );
    expect(even.separationRisk.level).toBe('low');

    const wide = buildGroupPlan(
      [
        member({ memberId: 'speedy', flatSpeedKmH: 6 }),
        member({ memberId: 'walker', flatSpeedKmH: 3 }),
      ],
      FLAT_SEGMENTS
    );
    expect(wide.separationRisk.spreadKmH).toBeGreaterThan(2);
    expect(wide.separationRisk.level).toBe('high');
    expect(wide.separationRisk.reasons.join(' ').toLowerCase()).toContain('écart');

    const withChild = buildGroupPlan(
      [
        member({ memberId: 'p1', flatSpeedKmH: 4 }),
        member({ memberId: 'p2', flatSpeedKmH: 4 }),
        member({ memberId: 'kid', flatSpeedKmH: 4, isChild: true }),
      ],
      FLAT_SEGMENTS
    );
    expect(withChild.separationRisk.level).not.toBe('low');
    expect(withChild.separationRisk.reasons.join(' ').toLowerCase()).toContain('enfant');
  });

  it('TEST-A8-GRP-05: la redistribution du portage est plafonnée et épargne les enfants', () => {
    const limiting = member({
      memberId: 'limiting',
      flatSpeedKmH: 2.5,
      ascentSpeedMPerHour: 180,
      descentSpeedMPerHour: 260,
      packWeightKg: 20,
      maxCarryKg: 8,
    });
    const carrier = member({
      memberId: 'carrier',
      flatSpeedKmH: 5,
      packWeightKg: 2,
      maxCarryKg: 20,
    });
    const secondCarrier = member({
      memberId: 'carrier-2',
      flatSpeedKmH: 5.2,
      packWeightKg: 1,
      maxCarryKg: 20,
    });
    const child = member({
      memberId: 'kid',
      flatSpeedKmH: 4,
      packWeightKg: 0,
      maxCarryKg: 20,
      isChild: true,
    });

    const plan = buildGroupPlan([limiting, carrier, secondCarrier, child], SEGMENTS);
    expect(plan.limitingMemberId).toBe('limiting');

    const excess = 20 - 8;
    const transferred = plan.gearRedistribution.reduce((sum, entry) => sum + entry.weightKg, 0);

    expect(plan.gearRedistribution.length).toBeGreaterThan(0);
    expect(transferred).toBeLessThanOrEqual(excess + 0.001);
    for (const transfer of plan.gearRedistribution) {
      expect(transfer.fromMemberId).toBe('limiting');
      expect(transfer.toMemberId).not.toBe('kid');
      expect(transfer.weightKg).toBeGreaterThan(0);
      expect(transfer.weightKg).toBeLessThanOrEqual(MAX_GEAR_TRANSFER_KG + 0.001);
      expect(transfer.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('TEST-A8-GRP-06: la projection publique ne révèle aucune identité, vitesse individuelle ni donnée santé', () => {
    const members = [
      member({
        memberId: 'm-alice',
        displayName: 'Alice',
        flatSpeedKmH: 4.8,
        limitations: ['asthme sévère'],
      }),
      member({ memberId: 'm-bob', displayName: 'Bob', flatSpeedKmH: 3.2 }),
    ];

    const plan = buildGroupPlan(members, SEGMENTS);
    const publicPlan = projectGroupPlanPublic(plan);
    const serialized = JSON.stringify(publicPlan);
    const serializedInternal = JSON.stringify(plan);

    expect(Object.keys(publicPlan).sort()).toEqual([
      'groupDifficulty',
      'groupPaceKmH',
      'limitingReason',
      'memberCount',
      'separationRisk',
    ]);
    expect(publicPlan.memberCount).toBe(2);

    for (const secret of [
      'Alice',
      'Bob',
      'm-alice',
      'm-bob',
      'asthme',
      'displayName',
      'memberId',
      'memberPacesKmH',
      'perMemberDifficulty',
      'gearRedistribution',
      'limitations',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serializedInternal).not.toContain('asthme');
  });
});
