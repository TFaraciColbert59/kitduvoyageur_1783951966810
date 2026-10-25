import { describe, it, expect, vi } from 'vitest';
import {
  buildCockpitLiveData,
  EMPTY_RECALC_STATE,
  type CockpitDataClient,
  type CockpitPredictionSource,
  type CockpitSessionSource,
} from '@/features/adventure-intelligence/server/cockpitData';
import { buildCockpitView } from '@/features/adventure-intelligence/domain/cockpit';
import { RECALC_REASONS } from '@/features/adventure-intelligence/domain/recalcTriggers';
import { adventureDecisionSchema, adventurePlanSchema } from '@/features/adventure-intelligence/schemas/adventurePlan.schema';
import type { StoredAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';

const USER_ID = 'a13c0001-1111-4111-8111-111111111111';
const PLAN_ID = 'a13c0002-2222-4222-8222-222222222222';
const SESSION_ID = 'a13c0003-3333-4333-8333-333333333333';
const NOW = '2026-09-11T12:00:00.000Z';
const BEFORE = '2026-09-11T11:54:00.000Z';

const PLAN = adventurePlanSchema.parse({
  id: PLAN_ID,
  ownerId: USER_ID,
  title: 'Tour du Queyras',
  status: 'active',
  currentVersion: 2,
  intent: { rawInput: 'Trek de trois jours', activities: ['hiking'], constraints: [] },
  confidence: { score: 0.9, level: 'high', sampleCount: 12, method: 'a3-v1' },
  createdAt: NOW,
  updatedAt: NOW,
});

const DECISION = adventureDecisionSchema.parse({
  id: 'a13c0004-4444-4444-8444-444444444444',
  planId: PLAN_ID,
  decisionType: 'other',
  proposal: 'Valider le refuge de la Moutière',
  requiresConfirmation: true,
  status: 'proposed',
  createdAt: NOW,
});

function planBundle(overrides: Partial<StoredAdventurePlan> = {}): StoredAdventurePlan {
  return {
    plan: PLAN,
    version: {
      version: 2,
      snapshot: PLAN,
      reason: 'generated',
      generatedBy: 'a13',
      confidence: PLAN.confidence,
      createdAt: NOW,
    },
    decisions: [DECISION],
    candidates: [],
    candidateComparison: null,
    ...overrides,
  };
}

const RECOMMENDED: CockpitPredictionSource = {
  strategy: 'recommended',
  etaP50: '2026-09-11T15:00:00.000Z',
  etaP90: '2026-09-11T16:10:00.000Z',
  paceP25: 4.5,
  paceP50: 5.2,
  paceP75: 6.1,
  turnaroundTime: '2026-09-11T17:00:00.000Z',
  personalDifficulty: 72,
  criticalSegmentIds: [777],
  modelVersion: 'a13-v1',
  computedAt: NOW,
  confidence: PLAN.confidence,
};

function session(overrides: Partial<CockpitSessionSource> = {}): CockpitSessionSource {
  return {
    id: SESSION_ID,
    startedAt: BEFORE,
    endedAt: null,
    distanceKm: 3.2,
    durationSeconds: 43 * 60,
    positions: [
      { lat: 44.0, lng: 6.0, timestamp: BEFORE },
      { lat: 44.004, lng: 6.0, timestamp: NOW },
    ],
    updatedAt: NOW,
    ...overrides,
  };
}

interface ClientOverrides {
  bundle?: StoredAdventurePlan | null;
  predictions?: (typeof RECOMMENDED)[];
  summaries?: { segmentId: number; label: string | null; personalDifficulty: number | null }[];
  sessions?: CockpitSessionSource[];
  terrain?: { id: string; category: string; severity: 'info' | 'warning' | 'critical'; distanceM: number }[];
}

function makeClient(overrides: ClientOverrides = {}) {
  const getPlanBundle = vi.fn(async () => {
    return overrides.bundle === undefined ? planBundle() : overrides.bundle;
  });
  const listRoutePredictions = vi.fn(async () => overrides.predictions ?? [RECOMMENDED]);
  const listSegmentSummaries = vi.fn(
    async () =>
      overrides.summaries ?? [
        { segmentId: 777, label: 'Col de la Moutière', personalDifficulty: 88 },
      ]
  );
  const listRecentSessions = vi.fn(async () => overrides.sessions ?? [session()]);
  const listTerrainReportsNear = vi.fn(
    async () =>
      overrides.terrain ?? [
        { id: 'r1', category: 'mud', severity: 'warning' as const, distanceM: 400 },
      ]
  );

  const client: CockpitDataClient = {
    getPlanBundle,
    listRoutePredictions,
    listSegmentSummaries,
    listRecentSessions,
    listTerrainReportsNear,
  };
  return {
    client,
    getPlanBundle,
    listRoutePredictions,
    listSegmentSummaries,
    listRecentSessions,
    listTerrainReportsNear,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    planId: PLAN_ID,
    now: NOW,
    featureFlags: { terrain_live: true },
    trackingPositions: [
      { lat: 44.0, lng: 6.0, timestamp: BEFORE },
      { lat: 44.004, lng: 6.0, timestamp: NOW },
    ],
    ...overrides,
  } as Parameters<typeof buildCockpitLiveData>[0];
}

describe('A13 — Cockpit live branché au tracking réel (TEST-A13-COCK)', () => {
  it('TEST-A13-COCK-01: assemblage réel — plan version courante, prédiction persistée, sessions et Terrain Live', async () => {
    const harness = makeClient();

    const result = await buildCockpitLiveData(request(), harness.client);

    expect(harness.getPlanBundle).toHaveBeenCalledWith(PLAN_ID);
    expect(harness.listRoutePredictions).toHaveBeenCalledWith(PLAN_ID, USER_ID);
    expect(harness.listSegmentSummaries).toHaveBeenCalledWith(USER_ID, [777]);
    expect(harness.listRecentSessions).toHaveBeenCalledWith(USER_ID, 5);

    expect(result.input.plan).toMatchObject({
      id: PLAN_ID,
      title: 'Tour du Queyras',
      status: 'active',
      etaP50: RECOMMENDED.etaP50,
      etaP90: RECOMMENDED.etaP90,
      personalDifficulty: 72,
    });
    expect(result.input.prediction).toMatchObject({
      strategy: 'recommended',
      paceRangeMinPerKm: [4.5, 6.1],
      turnaroundTime: RECOMMENDED.turnaroundTime,
      nextCriticalSegment: { id: 777, label: 'Col de la Moutière', difficulty: 88 },
    });
    expect(result.input.decisionsRequired).toEqual([
      { id: DECISION.id, label: 'Valider le refuge de la Moutière', requiresConfirmation: true },
    ]);
    expect(result.input.liveReports).toHaveLength(1);
    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.trackingSource).toBe('live_client');
    expect(result.warnings).toEqual([]);

    const view = buildCockpitView(result.input);
    expect(view.hero.title).toBe('Tour du Queyras');
    expect(view.hero.status).toBe('En cours');
    expect(view.eta.p50).toBe(RECOMMENDED.etaP50);
    expect(view.eta.p90).toBe(RECOMMENDED.etaP90);
    expect(view.difficulty.value).toBe(72);
    expect(view.paceStrategy).toEqual({ id: 'recommended', label: 'Recommandée' });
    expect(view.turnaroundTime).toBe(RECOMMENDED.turnaroundTime);
    expect(view.alerts[0]).toMatchObject({ id: 'r1', severity: 'warning' });
  });

  it('TEST-A13-COCK-02: anti-rebond 60 s — evaluateRecalc seul décide, état inchangé sous le délai', async () => {
    const harness = makeClient();
    const positions = [
      { lat: 44.0, lng: 6.0, timestamp: '2026-09-11T11:58:00.000Z' },
      { lat: 44.004, lng: 6.0, timestamp: NOW },
    ];

    const debounced = await buildCockpitLiveData(
      request({
        trackingPositions: positions,
        recalcState: {
          ...EMPTY_RECALC_STATE,
          lastRecalcAt: '2026-09-11T11:59:30.000Z',
          lastPosition: { lat: 44.0, lng: 6.0 },
          lastPositionAt: '2026-09-11T11:58:00.000Z',
          lastPaceMinPerKm: 10,
        },
      }),
      harness.client
    );

    expect(debounced.recalc.shouldRecalculate).toBe(false);
    expect(debounced.recalc.reasons).toContain(RECALC_REASONS.position);
    expect(debounced.recalc.nextState.lastRecalcAt).toBe('2026-09-11T11:59:30.000Z');
    expect(debounced.input.recalcReasons).toContain(RECALC_REASONS.position);

    const allowed = await buildCockpitLiveData(
      request({
        trackingPositions: positions,
        recalcState: {
          ...EMPTY_RECALC_STATE,
          lastRecalcAt: '2026-09-11T11:58:00.000Z',
          lastPosition: { lat: 44.0, lng: 6.0 },
          lastPositionAt: '2026-09-11T11:58:00.000Z',
          lastPaceMinPerKm: 10,
        },
      }),
      harness.client
    );

    expect(allowed.recalc.shouldRecalculate).toBe(true);
    expect(allowed.recalc.nextState.lastRecalcAt).toBe(NOW);
    expect(allowed.recalc.nextState.lastPosition).toEqual({ lat: 44.004, lng: 6.0 });

    const replay = await buildCockpitLiveData(
      request({ trackingPositions: positions, recalcState: allowed.recalc.nextState }),
      harness.client
    );
    expect(replay.recalc.shouldRecalculate).toBe(false);
  });

  it('TEST-A13-COCK-03: hors-ligne signalé à la vue sans bloquer l’assemblage', async () => {
    const harness = makeClient();

    const result = await buildCockpitLiveData(request({ offline: true }), harness.client);

    expect(result.input.offline).toBe(true);
    expect(buildCockpitView(result.input).hero.subtitle).toBe('Mode hors-ligne — données locales');
    expect(result.input.plan).not.toBeNull();
  });

  it('TEST-A13-COCK-04: ETA toujours en fourchette P50–P90, jamais de fausse précision', async () => {
    const inverted = makeClient({
      predictions: [{ ...RECOMMENDED, etaP50: '2026-09-11T16:00:00.000Z', etaP90: '2026-09-11T15:00:00.000Z' }],
    });
    const invertedResult = await buildCockpitLiveData(request(), inverted.client);
    const invertedView = buildCockpitView(invertedResult.input);
    expect(Date.parse(invertedView.eta.p90 as string)).toBeGreaterThanOrEqual(
      Date.parse(invertedView.eta.p50 as string)
    );

    const partial = makeClient({
      predictions: [{ ...RECOMMENDED, etaP90: null }],
    });
    const partialView = buildCockpitView(
      (await buildCockpitLiveData(request(), partial.client)).input
    );
    expect(partialView.eta.p50).toBe(RECOMMENDED.etaP50);
    expect(partialView.eta.p90).toBeNull();
  });

  it('TEST-A13-COCK-05: confiance réelle propagée ; confiance non conforme ⇒ profil froid explicite', async () => {
    const valid = makeClient();
    const validResult = await buildCockpitLiveData(request(), valid.client);
    expect(validResult.input.plan?.confidence).toMatchObject({ score: 0.9, level: 'high' });
    expect(buildCockpitView(validResult.input).confidence?.score).toBe(0.9);

    const invalidBundle = planBundle();
    const corrupted = {
      ...invalidBundle,
      plan: { ...invalidBundle.plan, confidence: { score: 2, level: 'nope' } },
    } as unknown as StoredAdventurePlan;
    const cold = makeClient({ bundle: corrupted });
    const coldResult = await buildCockpitLiveData(request(), cold.client);
    expect(coldResult.input.plan?.confidence).toMatchObject({ score: 0, level: 'low', method: 'cold' });
  });

  it('TEST-A13-COCK-06: aventure absente = état vide sûr, aucune donnée inventée, aucun appel superflu', async () => {
    const harness = makeClient({ bundle: null });

    const result = await buildCockpitLiveData(request(), harness.client);

    expect(result.input.plan).toBeNull();
    expect(result.input.prediction).toBeNull();
    expect(result.input.liveReports).toEqual([]);
    expect(result.input.decisionsRequired).toEqual([]);
    expect(result.recalc.shouldRecalculate).toBe(false);
    expect(result.recalc.reasons).toEqual([]);
    expect(result.sessionId).toBeNull();
    expect(result.trackingSource).toBe('none');
    expect(result.warnings).toContain('plan_not_found');

    expect(harness.listRoutePredictions).not.toHaveBeenCalled();
    expect(harness.listRecentSessions).not.toHaveBeenCalled();
    expect(harness.listTerrainReportsNear).not.toHaveBeenCalled();

    const view = buildCockpitView(result.input);
    expect(view.hero.title).toBe('Aventure');
    expect(view.indicators).toEqual([]);
    expect(view.eta).toEqual({ p50: null, p90: null, aheadBehindMinutes: null });
  });
});
