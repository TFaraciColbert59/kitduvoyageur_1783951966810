/**
 * A13 (S2) — Trois plans réellement comparables + sélection matérialisée.
 *
 *   • TEST-A13-CAND-01 : les trois candidats partagent route, dates, hébergements.
 *   • TEST-A13-CAND-02 : seules les dimensions autorisées diffèrent, documentées.
 *   • TEST-A13-CAND-03 : la comparaison est dérivée des prédictions S1 réelles.
 *   • TEST-A13-CAND-04 : repli explicite en estimations (jamais silencieux).
 *   • TEST-A13-CAND-05 : matérialisation idempotente et traçable.
 *   • TEST-A13-SELECT-01..06 : route POST /select (auth, 404/403/400, RPC) +
 *     exposition GET `candidateComparison` quand la version le contient.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildCandidateComparison,
  buildCandidateMaterialization,
  buildCandidatePlans,
  type CandidateStrategyInputs,
} from '@/features/adventure-intelligence/domain/candidatePlans';
import {
  type AdventurePlan,
  type PlanValue,
} from '@/features/adventure-intelligence/domain/adventurePlan';
import { buildCandidates } from '@/features/adventure-intelligence/domain/candidates';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';

const serviceMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceMock),
}));
vi.mock('@/features/adventure-intelligence/server/generateAdventure', () => ({
  getAdventurePlan: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';
import { POST as selectPOST } from '@/app/api/adventure/[id]/select/route';
import { GET as planGET } from '@/app/api/adventure/[id]/route';

const PLAN_ID = 'a1300000-0000-4000-8000-0000000000c1';
const OWNER_ID = 'a1300000-0000-4000-8000-0000000000c2';
const OTHER_ID = 'a1300000-0000-4000-8000-0000000000c3';
const NOW = '2026-09-11T12:00:00.000Z';
const BASE_DAYS = 6;
const BASE_DISTANCE_KM = 90;
const BASE_GAIN_M = 4200;
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

function strategyPrediction(strategy: 'comfort' | 'recommended' | 'fast', p50Seconds: number) {
  return {
    strategy,
    etaP50: new Date(Date.parse(NOW) + p50Seconds * 1000).toISOString(),
    etaP90: new Date(Date.parse(NOW) + Math.round(p50Seconds * 1.3) * 1000).toISOString(),
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

const S1_P50 = { comfort: 60000, recommended: 55000, fast: 50000 } as const;

function candidatesFixture() {
  return buildCandidates({
    days: BASE_DAYS,
    participantsCount: 2,
    budgetTier: 'moderate',
  });
}

function makeBasePlan(
  segmentation: 'map_matched' | 'uniform_from_blueprint' = 'map_matched'
): AdventurePlan {
  const candidates = candidatesFixture();
  const strategies = [
    strategyPrediction('comfort', S1_P50.comfort),
    strategyPrediction('recommended', S1_P50.recommended),
    strategyPrediction('fast', S1_P50.fast),
  ];
  return {
    id: PLAN_ID,
    ownerId: OWNER_ID,
    title: 'Aventure — Massif du Sancy',
    status: 'draft',
    currentVersion: 1,
    intent: { rawInput: 'Trek de six jours', activities: ['hiking'], constraints: [] },
    participants: [{ id: OWNER_ID, displayName: 'Propriétaire', role: 'owner' }],
    dates: { start: '2026-09-20T08:00:00.000Z', end: '2026-09-26T18:00:00.000Z', flexible: false },
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
        totalGainM: BASE_GAIN_M,
        totalLossM: BASE_GAIN_M,
        difficulty: 'moderate',
      }),
      terrainAnalysis: planValue({
        totalDistanceKm: BASE_DISTANCE_KM,
        totalGainM: BASE_GAIN_M,
        totalLossM: BASE_GAIN_M,
        difficulty: 'moderate',
      }),
      personalDifficulty: planValue({ personalDifficulty: 48, segmentCount: BASE_DAYS }),
      groupDifficulty: planValue({ groupDifficulty: 52 }),
      paceStrategies: planValue({
        strategies,
        primary: strategies[1],
        segmentation,
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
  return { candidates: candidatesFixture(), now: NOW };
}

function materialize(base: AdventurePlan = makeBasePlan()): {
  base: AdventurePlan;
  plans: AdventurePlan[];
  comparison: ReturnType<typeof buildCandidateComparison>;
} {
  const plans = buildCandidatePlans({ plan: base, strategyInputs: strategyInputs() });
  const comparison = buildCandidateComparison({
    planId: base.id,
    candidatePlans: plans,
    candidates: candidatesFixture(),
    now: NOW,
  });
  return { base, plans, comparison };
}

function primaryOf(plan: AdventurePlan): {
  strategy: string;
  totalDurationP50Seconds: number;
  totalDurationP90Seconds: number;
  pausesSeconds: number;
} {
  const section = plan.sections.paceStrategies;
  if (section === null) throw new Error('paceStrategies absente');
  const value = section.value as {
    primary: {
      strategy: string;
      totalDurationP50Seconds: number;
      totalDurationP90Seconds: number;
      pausesSeconds: number;
    };
  };
  return value.primary;
}

function storedFixture(comparison: ReturnType<typeof buildCandidateComparison> | null) {
  const base = makeBasePlan();
  const plans = buildCandidatePlans({ plan: base, strategyInputs: strategyInputs() });
  return {
    plan: base,
    version: {
      version: 1,
      snapshot: {},
      reason: 'Génération initiale',
      generatedBy: 'a6-orchestrator',
      confidence: base.confidence,
      createdAt: NOW,
    },
    decisions: [],
    candidates: plans,
    candidateComparison: comparison,
  };
}

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function selectRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/adventure/${PLAN_ID}/select`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function planRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/adventure/${id}`, { method: 'GET' });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const mockedCreateClient = vi.mocked(createClient);
const mockedGetPlan = vi.mocked(getAdventurePlan);

describe('A13 (S2) — comparabilité réelle des trois plans', () => {
  it('TEST-A13-CAND-01: route, dates et hébergements partagés par les trois candidats', () => {
    const { base, plans, comparison } = materialize();

    expect(plans).toHaveLength(3);
    for (const plan of plans) {
      expect(plan.dates).toEqual(base.dates);
      expect(plan.sections.activityRoutes?.value).toEqual(base.sections.activityRoutes?.value);
      expect(plan.sections.terrainAnalysis?.value).toEqual(base.sections.terrainAnalysis?.value);
      expect(plan.sections.accommodations?.value).toEqual(base.sections.accommodations?.value);
      expect(plan.sections.dailyStages?.value).toEqual(base.sections.dailyStages?.value);
    }

    expect(comparison.sharedRoute).toBe(true);
    expect(comparison.sharedDates).toBe(true);
    expect(comparison.sharedAccommodations).toBe(true);
    expect(comparison.rows).toHaveLength(3);
  });

  it('TEST-A13-CAND-02: seules les dimensions autorisées diffèrent, chacune documentée', () => {
    const { plans, comparison } = materialize();
    const rows = comparison.rows;

    expect(rows.map((row) => row.candidateId)).toEqual(['comfort', 'balanced', 'adventure']);
    expect(plans.map((plan) => primaryOf(plan).strategy)).toEqual([
      'comfort',
      'recommended',
      'fast',
    ]);

    const budgets = rows.map((row) => row.budgetTotalEur ?? 0);
    expect(budgets[0]).toBeGreaterThan(budgets[1]);
    expect(budgets[1]).toBeGreaterThan(budgets[2]);
    expect(budgets[1]).toBeCloseTo(BASE_BUDGET_TOTAL, 5);

    const difficulties = rows.map((row) => row.personalDifficulty ?? 0);
    expect(difficulties[0]).toBeLessThan(difficulties[1]);
    expect(difficulties[1]).toBeLessThan(difficulties[2]);

    const pauses = rows.map((row) => row.pausesSeconds ?? 0);
    expect(pauses[0]).toBeGreaterThan(pauses[2]);

    for (const row of rows) {
      const reasons = row.reasons.join(' ');
      expect(reasons).toContain('Allure');
      expect(reasons).toContain('Marge');
      expect(reasons).toContain('Effort');
      expect(reasons).toContain('Budget');
      expect(row.riskScore).toBeGreaterThanOrEqual(0);
      expect(row.comfortScore).toBeGreaterThanOrEqual(0);
      expect(row.uncertainty).toBeGreaterThanOrEqual(0);
    }
  });

  it('TEST-A13-CAND-03: comparaison dérivée des prédictions S1 quand disponibles', () => {
    const { plans, comparison } = materialize(makeBasePlan('map_matched'));
    const byId = Object.fromEntries(comparison.rows.map((row) => [row.candidateId, row]));

    expect(comparison.segmentation).toBe('map_matched');
    expect(comparison.rows.every((row) => row.durationSource === 'computed')).toBe(true);
    expect(comparison.rows.every((row) => /map-match/i.test(row.durationNotes))).toBe(true);

    expect(byId.balanced.durationP50Seconds).toBe(S1_P50.recommended);
    expect(byId.comfort.durationP50Seconds).toBeGreaterThan(S1_P50.comfort);
    expect(byId.adventure.durationP50Seconds).toBeLessThan(S1_P50.fast);

    plans.forEach((plan, index) => {
      const primary = primaryOf(plan);
      const row = comparison.rows[index];
      expect(row.durationP50Seconds).toBe(primary.totalDurationP50Seconds);
      expect(row.durationP90Seconds).toBe(primary.totalDurationP90Seconds);
      expect(row.pausesSeconds).toBe(primary.pausesSeconds);
    });
  });

  it('TEST-A13-CAND-04: sans route réelle, estimations explicites jamais silencieuses', () => {
    const { comparison } = materialize(makeBasePlan('uniform_from_blueprint'));

    expect(comparison.segmentation).toBe('uniform_from_blueprint');
    expect(comparison.rows.every((row) => row.durationSource === 'estimated')).toBe(true);
    expect(
      comparison.rows.every((row) => /uniform|repli|estim/i.test(row.durationNotes))
    ).toBe(true);
    expect(
      comparison.rows.every(
        (row) => Number.isFinite(row.durationP50Seconds) && Number.isFinite(row.durationP90Seconds)
      )
    ).toBe(true);
  });

  it('TEST-A13-CAND-05: matérialisation idempotente, traçable et sans candidat inventé', () => {
    const { base, plans, comparison } = materialize();
    const first = buildCandidateMaterialization({
      plan: base,
      candidatePlans: plans,
      candidateId: 'adventure',
      comparison,
      now: NOW,
    });
    const replay = buildCandidateMaterialization({
      plan: base,
      candidatePlans: plans,
      candidateId: 'adventure',
      comparison,
      now: NOW,
    });

    expect(first).not.toBeNull();
    expect(first?.label).toBe('Aventure');
    expect(first?.version.version).toBe(base.currentVersion + 1);
    expect(first?.version.snapshot).toMatchObject({
      candidateId: 'adventure',
      currentVersion: base.currentVersion + 1,
    });
    expect(
      Array.isArray((first?.version.snapshot as { candidates?: unknown }).candidates)
    ).toBe(true);
    expect(first?.decision).toMatchObject({ requires_confirmation: false, created_at: NOW });
    expect(first?.decision.proposal).toContain('Aventure');

    expect(replay?.version).toEqual(first?.version);
    expect(replay?.decision).toEqual(first?.decision);

    expect(
      buildCandidateMaterialization({
        plan: base,
        candidatePlans: plans,
        candidateId: 'inconnue',
        comparison,
        now: NOW,
      })
    ).toBeNull();
  });
});

describe('A13 (S2) — API sélection matérialisée', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.rpc.mockResolvedValue({ data: 2, error: null });
    mockedCreateClient.mockResolvedValue(sessionClient({ id: OWNER_ID }));
    mockedGetPlan.mockResolvedValue(storedFixture(null) as never);
  });

  it('TEST-A13-SELECT-01: session requise (401)', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await selectPOST(selectRequest({ candidateId: 'comfort' }), params(PLAN_ID));

    expect(response.status).toBe(401);
    expect(serviceMock.rpc).not.toHaveBeenCalled();
  });

  it('TEST-A13-SELECT-02: plan inconnu (404)', async () => {
    mockedGetPlan.mockResolvedValue(null);

    const response = await selectPOST(selectRequest({ candidateId: 'comfort' }), params(PLAN_ID));

    expect(response.status).toBe(404);
    expect(serviceMock.rpc).not.toHaveBeenCalled();
  });

  it('TEST-A13-SELECT-03: non-propriétaire (403) sans matérialisation', async () => {
    mockedGetPlan.mockResolvedValue({
      ...storedFixture(null),
      plan: { ...makeBasePlan(), ownerId: OTHER_ID },
    } as never);

    const response = await selectPOST(selectRequest({ candidateId: 'comfort' }), params(PLAN_ID));

    expect(response.status).toBe(403);
    expect(serviceMock.rpc).not.toHaveBeenCalled();
  });

  it('TEST-A13-SELECT-04: candidateId invalide (400)', async () => {
    const invalidBody = await selectPOST(selectRequest({ candidateId: 42 }), params(PLAN_ID));
    expect(invalidBody.status).toBe(400);

    const unknown = await selectPOST(selectRequest({ candidateId: 'inconnue' }), params(PLAN_ID));
    expect(unknown.status).toBe(400);
    expect(serviceMock.rpc).not.toHaveBeenCalled();
  });

  it('TEST-A13-SELECT-05: appelle la RPC service_role et renvoie la version matérialisée', async () => {
    const response = await selectPOST(selectRequest({ candidateId: 'comfort' }), params(PLAN_ID));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.version).toBe(2);

    expect(serviceMock.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = serviceMock.rpc.mock.calls[0];
    expect(fn).toBe('a13_materialize_candidate');
    expect(args.p_user_id).toBe(OWNER_ID);
    expect(args.p_plan_id).toBe(PLAN_ID);
    expect(args.p_version).toMatchObject({
      snapshot: expect.objectContaining({ candidateId: 'comfort' }),
      generated_by: 'a13-select',
    });
    expect(String(args.p_decision.proposal)).toContain('Confort');
  });

  it('TEST-A13-SELECT-06: GET expose candidateComparison quand la version le contient', async () => {
    const comparison = materialize().comparison;
    mockedGetPlan.mockResolvedValue(storedFixture(comparison) as never);

    const withComparison = await planGET(planRequest(PLAN_ID), params(PLAN_ID));
    expect(withComparison.status).toBe(200);
    const body = await withComparison.json();
    expect(body.candidateComparison.rows).toHaveLength(3);

    mockedGetPlan.mockResolvedValue(storedFixture(null) as never);
    const withoutComparison = await planGET(planRequest(PLAN_ID), params(PLAN_ID));
    const withoutBody = await withoutComparison.json();
    expect(withoutBody.candidateComparison).toBeUndefined();
  });
});
