import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  adventurePlanSchema,
  adventureDecisionSchema,
  planValueSchema,
  planVersionMetaSchema,
  ADVENTURE_PLAN_SECTION_KEYS,
  type AdventurePlanInput,
} from '@/features/adventure-intelligence/schemas/adventurePlan.schema';
import {
  assertNoSilentLockOverride,
  type AdventureConstraint,
} from '@/features/adventure-intelligence/domain/constraints';
import {
  requiresConfirmation,
  DECISION_TYPES,
} from '@/features/adventure-intelligence/domain/decisions';
import type { AdventurePlan } from '@/features/adventure-intelligence/domain/adventurePlan';

const PLAN_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const DECISION_ID = '33333333-3333-4333-8333-333333333333';
const COMPUTED_AT = '2026-09-11T10:00:00.000Z';

const COLD_CONFIDENCE = {
  score: 0,
  level: 'low' as const,
  sampleCount: 0,
  method: 'cold',
  reasons: ['Profil froid — aucune donnée personnelle disponible'],
};

function emptySections(): AdventurePlan['sections'] {
  return {
    transport: null,
    localMobility: null,
    accommodations: null,
    dailyStages: null,
    activityRoutes: null,
    terrainAnalysis: null,
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
  };
}

const minimalPlanInput: AdventurePlanInput = {
  id: PLAN_ID,
  ownerId: OWNER_ID,
  intent: { rawInput: 'Un trek de cinq jours dans les Pyrénées' },
};

describe('AdventurePlan — schéma et types (TEST-A1-PLAN)', () => {
  it('TEST-A1-PLAN-01: un plan minimal est valide et applique les défauts sûrs', () => {
    const parsed = adventurePlanSchema.parse(minimalPlanInput);

    expect(parsed.id).toBe(PLAN_ID);
    expect(parsed.ownerId).toBe(OWNER_ID);
    expect(parsed.status).toBe('draft');
    expect(parsed.currentVersion).toBe(0);
    expect(parsed.participants).toEqual([]);
    expect(parsed.destinations).toEqual([]);
    expect(parsed.monitoringRules).toEqual([]);
    expect(parsed.dates.flexible).toBe(false);
    expect(parsed.confidence.level).toBe('low');
    expect(parsed.confidence.score).toBe(0);
    expect(parsed.intent.activities).toEqual([]);
    expect(parsed.intent.constraints).toEqual([]);

    expect([...ADVENTURE_PLAN_SECTION_KEYS]).toHaveLength(19);
    expect(Object.keys(parsed.sections)).toHaveLength(19);
    for (const key of ADVENTURE_PLAN_SECTION_KEYS) {
      expect(parsed.sections[key]).toBeNull();
    }
  });

  it('TEST-A1-PLAN-02: une section complète PlanValue<T> est valide', () => {
    const parsed = adventurePlanSchema.parse({
      ...minimalPlanInput,
      sections: {
        transport: {
          value: { modes: ['train'], note: 'TGV Paris → Luchon' },
          confidence: { score: 0.8, level: 'high', sampleCount: 4, method: 'transport-v1' },
          provenance: [{ source: 'official', sourceRef: 'sncf' }],
          assumptions: [{ id: 'a-1', label: 'Horaires stables' }],
          warnings: [{ code: 'W-1', message: 'Correspondance courte', severity: 'warning' }],
          impacts: [{ id: 'i-1', section: 'budget', label: 'Coût transport', severity: 'warning' }],
          computedAt: COMPUTED_AT,
          validUntil: '2026-09-12T10:00:00.000Z',
        },
      },
    });

    const transport = parsed.sections.transport;
    expect(transport).not.toBeNull();
    expect(transport?.confidence.level).toBe('high');
    expect(transport?.provenance[0].source).toBe('official');
    expect(transport?.assumptions).toHaveLength(1);
    expect(transport?.warnings[0].code).toBe('W-1');
    expect(transport?.impacts[0].section).toBe('budget');
    expect(transport?.validUntil).toBe('2026-09-12T10:00:00.000Z');
    expect(parsed.sections.budget).toBeNull();
  });

  it('TEST-A1-PLAN-03: validUntil antérieur à computedAt est rejeté par refine', () => {
    const result = adventurePlanSchema.safeParse({
      ...minimalPlanInput,
      sections: {
        budget: {
          value: 1200,
          confidence: COLD_CONFIDENCE,
          provenance: [],
          assumptions: [],
          warnings: [],
          impacts: [],
          computedAt: COMPUTED_AT,
          validUntil: '2026-09-11T09:00:00.000Z',
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.').includes('validUntil'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('validUntil');
    }

    const direct = planValueSchema(z.string()).safeParse({
      value: 'x',
      confidence: COLD_CONFIDENCE,
      provenance: [],
      assumptions: [],
      warnings: [],
      impacts: [],
      computedAt: COMPUTED_AT,
      validUntil: '2026-09-11T09:00:00.000Z',
    });
    expect(direct.success).toBe(false);
  });

  it('TEST-A1-PLAN-04: toute décision non "other" exige une confirmation', () => {
    expect(DECISION_TYPES).toHaveLength(6);
    for (const type of DECISION_TYPES) {
      expect(requiresConfirmation(type)).toBe(type !== 'other');
    }

    const payment = adventureDecisionSchema.parse({
      id: DECISION_ID,
      planId: PLAN_ID,
      decisionType: 'payment',
      proposal: 'Payer l’hébergement',
      status: 'proposed',
      createdAt: COMPUTED_AT,
    });
    expect(payment.requiresConfirmation).toBe(true);
    expect(payment.impact).toEqual([]);

    const other = adventureDecisionSchema.parse({
      id: DECISION_ID,
      planId: PLAN_ID,
      decisionType: 'other',
      proposal: 'Renommer une étape',
      status: 'proposed',
      requiresConfirmation: false,
      createdAt: COMPUTED_AT,
    });
    expect(other.requiresConfirmation).toBe(false);
  });

  it('TEST-A1-PLAN-05: un verrou ne peut pas être remplacé silencieusement', () => {
    const before: AdventureConstraint[] = [
      {
        id: 'c-dates',
        kind: 'hard',
        label: 'Dates fixées',
        value: { start: '2026-09-20', end: '2026-09-25' },
        locked: true,
        source: 'user',
      },
      {
        id: 'c-budget',
        kind: 'soft',
        label: 'Budget indicatif',
        value: 900,
        locked: false,
        source: 'user',
      },
    ];

    expect(assertNoSilentLockOverride(before, before)).toBe(true);

    const changedLockedValue = [
      { ...before[0], value: { start: '2026-09-21', end: '2026-09-25' } },
      before[1],
    ];
    expect(assertNoSilentLockOverride(before, changedLockedValue)).toBe(false);

    const unlockedSilently = [{ ...before[0], locked: false }, before[1]];
    expect(assertNoSilentLockOverride(before, unlockedSilently)).toBe(false);

    const removed = [before[1]];
    expect(assertNoSilentLockOverride(before, removed)).toBe(false);

    const unlockedSoftChanged = [before[0], { ...before[1], value: 1200 }];
    expect(assertNoSilentLockOverride(before, unlockedSoftChanged)).toBe(true);
  });

  it('TEST-A1-PLAN-06: audit sémantique — un littéral satisfies AdventurePlan est validé', () => {
    const candidate = {
      id: PLAN_ID,
      ownerId: OWNER_ID,
      tripId: undefined,
      title: 'Trek des lacs',
      status: 'active',
      currentVersion: 1,
      intent: {
        rawInput: 'Un trek de cinq jours dans les Pyrénées',
        summary: 'Boucle des lacs',
        activities: ['trek'],
        constraints: ['pas de bivouac'],
      },
      participants: [{ id: 'p-1', displayName: 'Tony', role: 'owner' }],
      dates: { start: '2026-09-20T00:00:00.000Z', end: '2026-09-25T00:00:00.000Z', flexible: false },
      destinations: [{ label: 'Pyrénées', countryCode: 'FR' }],
      sections: emptySections(),
      confidence: COLD_CONFIDENCE,
      monitoringRules: [
        { id: 'm-1', label: 'Météo J-3', kind: 'weather', enabled: true },
      ],
      createdAt: COMPUTED_AT,
      updatedAt: COMPUTED_AT,
    } satisfies AdventurePlan;

    const parsed = adventurePlanSchema.parse(candidate);
    const audited: AdventurePlan = parsed;

    expect(audited.title).toBe('Trek des lacs');
    expect(audited.participants[0].role).toBe('owner');
    expect(audited.sections.terrainAnalysis).toBeNull();
    expect(planVersionMetaSchema.safeParse({
      planId: PLAN_ID,
      version: 1,
      reason: 'generation initiale',
      generatedBy: 'orchestrator',
      confidence: COLD_CONFIDENCE,
      createdAt: COMPUTED_AT,
    }).success).toBe(true);
  });
});
