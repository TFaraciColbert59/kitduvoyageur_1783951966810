/**
 * A11 #14 — Trois plans candidats complets (TEST-A11-CAND-01..06).
 *
 * Le domaine produit trois `AdventurePlan` complets et différenciés à partir
 * du plan de référence, sans jamais muter ce dernier : chaque section est
 * clonée en profondeur, les valeurs stratégiques sont mises à l'échelle et la
 * provenance `estimated` est ajoutée aux sections modifiées.
 */
import { describe, it, expect } from 'vitest';
import {
  CANDIDATE_PACE_STRATEGIES,
  buildCandidatePlans,
  type CandidateStrategyInputs,
} from '@/features/adventure-intelligence/domain/candidatePlans';
import {
  ADVENTURE_PLAN_SECTION_KEYS,
  type AdventurePlan,
  type PlanValue,
} from '@/features/adventure-intelligence/domain/adventurePlan';
import { buildCandidates } from '@/features/adventure-intelligence/domain/candidates';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import { adventurePlanSchema } from '@/features/adventure-intelligence/schemas/adventurePlan.schema';
import {
  generateAdventure,
  type AdventureEnginePersistence,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';

const PLAN_ID = 'a1100000-0000-4000-8000-0000000000c1';
const OWNER_ID = 'a1100000-0000-4000-8000-0000000000c2';
const NOW = '2026-09-11T12:00:00.000Z';
const BASE_DAYS = 6;
const BASE_DISTANCE_KM = 90;
const BASE_BUDGET_TOTAL = 800;

function planValue<T>(value: T, computedAt = NOW): PlanValue<T> {
  return {
    value,
    confidence: makeConfidence({
      score: 0.6,
      sampleCount: 0,
      method: 'autogen_blueprint',
      reasons: ['Blueprint du catalogue LKDV'],
    }),
    provenance: [{ source: 'estimated', sourceRef: 'Catalogue de référence LKDV' }],
    assumptions: [],
    warnings: [],
    impacts: [],
    computedAt,
  };
}

function prediction(strategy: 'comfort' | 'recommended' | 'fast', p50Seconds: number) {
  return {
    strategy,
    etaP50: new Date(Date.parse(NOW) + p50Seconds * 1000).toISOString(),
    etaP90: new Date(Date.parse(NOW) + p50Seconds * 1.3 * 1000).toISOString(),
    totalDurationP50Seconds: p50Seconds,
    totalDurationP90Seconds: Math.round(p50Seconds * 1.3),
    paceP25MinPerKm: 12,
    paceP50MinPerKm: 13,
    paceP75MinPerKm: 15,
    pausesSeconds: 600,
    personalDifficulty: 40,
    maxFatigue: 55,
    criticalSegmentIds: [1, 2],
    warnings: [],
    confidence: makeConfidence({ score: 0.6, sampleCount: 0, method: 'a3' }),
    modelVersion: 'a3-v1',
    computedAt: NOW,
  };
}

function makeBasePlan(): AdventurePlan {
  const candidates = buildCandidates({
    days: BASE_DAYS,
    participantsCount: 2,
    budgetTier: 'moderate',
  });
  return {
    id: PLAN_ID,
    ownerId: OWNER_ID,
    title: 'Aventure — Massif du Sancy',
    status: 'draft',
    currentVersion: 1,
    intent: { rawInput: 'Trek de six jours', activities: ['hiking'], constraints: [] },
    participants: [{ id: OWNER_ID, displayName: 'Propriétaire', role: 'owner' }],
    dates: { start: '2026-09-20T08:00:00.000Z', flexible: true },
    destinations: [{ label: 'Massif du Sancy', countryCode: 'FR' }],
    sections: {
      transport: planValue({ modes: ['train'], note: 'Paris → Clermont-Ferrand' }),
      localMobility: planValue({ modes: ['voiture'], note: 'Navette locale' }),
      accommodations: planValue({ nights: 5, kind: 'refuge' }),
      dailyStages: planValue({
        days: BASE_DAYS,
        stagesCount: BASE_DAYS,
        phases: [{ id: 'phase-1', label: 'Approche' }],
      }),
      activityRoutes: planValue({
        stagesCount: BASE_DAYS,
        totalDistanceKm: BASE_DISTANCE_KM,
        totalGainM: 4200,
        totalLossM: 4200,
        difficulty: 'moderate',
      }),
      terrainAnalysis: planValue({
        totalDistanceKm: BASE_DISTANCE_KM,
        totalGainM: 4200,
        totalLossM: 4200,
        difficulty: 'moderate',
      }),
      personalDifficulty: planValue({ personalDifficulty: 48, segmentCount: BASE_DAYS }),
      groupDifficulty: planValue({ groupDifficulty: 52 }),
      paceStrategies: planValue({
        strategies: [
          prediction('comfort', 60000),
          prediction('recommended', 55000),
          prediction('fast', 50000),
        ],
        primary: prediction('recommended', 55000),
        segmentation: 'uniform_from_blueprint' as const,
        segmentCount: BASE_DAYS,
      }),
      foodAndWater: planValue({ refillPoints: 4 }),
      gearPlan: planValue({ missingCount: 1, totalWeightKg: 9.5 }),
      budget: planValue({
        perPersonEur: BASE_BUDGET_TOTAL / 2,
        totalEur: BASE_BUDGET_TOTAL,
        currency: 'EUR',
        summary: {
          estimatedBudget: BASE_BUDGET_TOTAL,
          totalSpent: 0,
          remainingBudget: BASE_BUDGET_TOTAL,
          currency: 'EUR',
        },
      }),
      bookings: null,
      documents: null,
      regulations: null,
      safetyPlan: planValue({ rescuePhone: '112', rescueUnit: 'PGM Le Mont-Dore' }),
      offlinePackage: null,
      liveConditions: null,
      alternatives: {
        ...planValue(
          candidates.map((candidate) => ({
            id: candidate.id,
            label: candidate.label,
            budgetDeltaPct: candidate.budgetDeltaPct,
            effortDeltaPct: candidate.effortDeltaPct,
            durationDeltaPct: candidate.durationDeltaPct,
            comfortScore: candidate.comfortScore,
            riskScore: candidate.riskScore,
            uncertainty: candidate.uncertainty,
            reasons: [...candidate.reasons],
          }))
        ),
        provenance: [{ source: 'computed', sourceRef: 'a6:candidates' }],
      },
    },
    confidence: makeConfidence({
      score: 0.55,
      sampleCount: 0,
      method: 'combined:min',
      reasons: ['Confiance globale du plan de référence'],
    }),
    monitoringRules: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function strategyInputs(): CandidateStrategyInputs {
  return {
    candidates: buildCandidates({
      days: BASE_DAYS,
      participantsCount: 2,
      budgetTier: 'moderate',
    }),
    now: NOW,
  };
}

function materialize(plan: AdventurePlan): AdventurePlan[] {
  return buildCandidatePlans({ plan, strategyInputs: strategyInputs() });
}

function sectionValue<T>(plan: AdventurePlan, key: keyof AdventurePlan['sections']): T {
  const section = plan.sections[key];
  if (section === null) throw new Error(`Section ${String(key)} absente du plan candidat`);
  return section.value as T;
}

describe('A11 — plans candidats complets (TEST-A11-CAND)', () => {
  it('TEST-A11-CAND-01: chaque candidat contient toutes les sections du plan de référence', () => {
    const base = makeBasePlan();
    const plans = materialize(base);

    expect(plans).toHaveLength(3);
    expect(plans.map((plan) => plan.id)).toEqual([PLAN_ID, PLAN_ID, PLAN_ID]);

    for (const plan of plans) {
      for (const key of ADVENTURE_PLAN_SECTION_KEYS) {
        expect(plan.sections, key).toHaveProperty(key);
        if (base.sections[key] !== null) {
          expect(plan.sections[key], key).not.toBeNull();
          expect(plan.sections[key], key).not.toBe(base.sections[key]);
        } else {
          expect(plan.sections[key], key).toBeNull();
        }
      }
      expect(adventurePlanSchema.safeParse(plan).success).toBe(true);
    }

    const [comfort] = plans;
    expect(comfort.sections.transport).not.toBe(base.sections.transport);
    expect(comfort.sections.accommodations).not.toBe(base.sections.accommodations);
    expect(comfort.sections.safetyPlan).not.toBe(base.sections.safetyPlan);
  });

  it('TEST-A11-CAND-02: route partagée ; seules l’allure et les marges différencient', () => {
    const base = makeBasePlan();
    const plans = materialize(base);

    const distances = plans.map(
      (plan) => sectionValue<{ totalDistanceKm: number }>(plan, 'terrainAnalysis').totalDistanceKm
    );
    expect(distances).toEqual([BASE_DISTANCE_KM, BASE_DISTANCE_KM, BASE_DISTANCE_KM]);

    const durations = plans.map(
      (plan) =>
        sectionValue<{ primary: { strategy: string; totalDurationP50Seconds: number } }>(
          plan,
          'paceStrategies'
        ).primary.totalDurationP50Seconds
    );
    expect(durations[0]).toBeGreaterThan(durations[1]);
    expect(durations[1]).toBeGreaterThan(durations[2]);

    const stageValues = plans.map((plan) =>
      sectionValue<Record<string, unknown>>(plan, 'dailyStages')
    );
    expect(stageValues).toEqual([
      base.sections.dailyStages?.value,
      base.sections.dailyStages?.value,
      base.sections.dailyStages?.value,
    ]);
  });

  it('TEST-A11-CAND-03: chaque variante est différenciée (allure, budget, annotations)', () => {
    const plans = materialize(makeBasePlan());

    const strategies = plans.map(
      (plan) => sectionValue<{ primary: { strategy: string } }>(plan, 'paceStrategies').primary.strategy
    );
    expect(strategies).toEqual([
      CANDIDATE_PACE_STRATEGIES.comfort,
      CANDIDATE_PACE_STRATEGIES.balanced,
      CANDIDATE_PACE_STRATEGIES.adventure,
    ]);

    const budgets = plans.map(
      (plan) => sectionValue<{ totalEur: number }>(plan, 'budget').totalEur
    );
    expect(budgets[0]).toBeGreaterThan(budgets[1]);
    expect(budgets[1]).toBeGreaterThan(budgets[2]);
    expect(budgets[1]).toBeCloseTo(BASE_BUDGET_TOTAL, 5);

    plans.forEach((plan, index) => {
      const alternatives = sectionValue<
        { id: string; selected: boolean; comfortScore: number; riskScore: number }[]
      >(plan, 'alternatives');
      const selected = alternatives.filter((entry) => entry.selected);
      expect(selected).toHaveLength(1);
      expect(selected[0].id).toBe(['comfort', 'balanced', 'adventure'][index]);
      expect(selected[0].riskScore).toBeGreaterThanOrEqual(0);
      expect(selected[0].comfortScore).toBeGreaterThanOrEqual(0);
    });
  });

  it('TEST-A11-CAND-04: les sections modifiées portent provenance estimated, confiance et computedAt', () => {
    const plans = materialize(makeBasePlan());
    const modifiedKeys = ['personalDifficulty', 'paceStrategies', 'budget', 'alternatives'] as const;

    for (const plan of plans) {
      for (const key of modifiedKeys) {
        const section = plan.sections[key];
        expect(section, key).not.toBeNull();
        const value = section as NonNullable<typeof section>;
        expect(value.provenance, key).toContainEqual(
          expect.objectContaining({ source: 'estimated' })
        );
        expect(value.confidence.score, key).toBeGreaterThanOrEqual(0);
        expect(value.computedAt, key).toBe(NOW);
      }
      expect(plan.confidence.reasons.some((reason) => reason.includes('Variante'))).toBe(true);
      expect(plan.updatedAt).toBe(NOW);
    }

    const [comfort, balanced, adventure] = plans;
    expect(
      comfort.confidence.reasons.join(' ').toLowerCase()
    ).toContain('confort');
    expect(
      adventure.confidence.reasons.join(' ').toLowerCase()
    ).toContain('risque');
    expect(
      balanced.confidence.reasons.join(' ').toLowerCase()
    ).toContain('équilibré');
  });

  it('TEST-A11-CAND-05: le plan de référence est profondément immuable (gel + instantané JSON)', () => {
    const base = makeBasePlan();
    const snapshot = JSON.stringify(base);

    function deepFreeze<T>(value: T): T {
      if (value !== null && typeof value === 'object') {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          deepFreeze(nested);
        }
        Object.freeze(value);
      }
      return value;
    }
    deepFreeze(base);

    expect(() => materialize(base)).not.toThrow();
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('TEST-A11-CAND-06: les trois plans sont persistés dans snapshot.candidates et relus', async () => {
    const plans: Record<string, unknown>[] = [];
    const versions: Record<string, unknown>[] = [];
    const persistence: AdventureEnginePersistence = {
      persistPlanBundle: async (bundle) => {
        plans.push(bundle.plan);
        versions.push(bundle.version);
        return { id: PLAN_ID };
      },
      insertEngineRun: async () => {},
    };

    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: 'Trek de six jours au Mont-Doux en juillet', now: NOW },
      {
        registry: createDefaultRegistry(),
        persistence,
        hasActiveConsent: async () => false,
        getCurrentProfile: async () => null,
        persistAdventurePredictions: async () => {},
      }
    );

    expect(result.candidatePlans).toHaveLength(3);
    expect(result.candidatePlans.every((plan) => plan.sections.alternatives !== null)).toBe(true);
    expect(versions).toHaveLength(1);
    const snapshot = versions[0].snapshot as { id: string; candidates?: AdventurePlan[] };
    expect(snapshot.id).toBe(PLAN_ID);
    expect(snapshot.candidates).toHaveLength(3);
    expect(snapshot.candidates?.every((plan) => plan.id === PLAN_ID)).toBe(true);
    for (const candidate of snapshot.candidates ?? []) {
      for (const key of ADVENTURE_PLAN_SECTION_KEYS) {
        expect(candidate.sections, key).toHaveProperty(key);
      }
    }
  });
});
