import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  store: {
    findByKey: vi.fn(),
    hasActivePending: vi.fn(),
    countRecent: vi.fn(),
    createPending: vi.fn(),
    markDone: vi.fn(),
    markFailed: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => ({})),
}));
vi.mock('@/features/adventure-intelligence/server/generationRequests', () => ({
  createSupabaseGenerationRequestStore: vi.fn(() => mocks.store),
}));
vi.mock('@/features/adventure-intelligence/server/adapters', () => ({
  createDefaultRegistry: vi.fn(() => ({ registry: true })),
}));
vi.mock('@/features/adventure-intelligence/server/generateAdventure', () => ({
  generateAdventure: vi.fn(),
  createSupabaseAdventurePersistence: vi.fn(() => ({ persistence: true })),
  createSupabaseAdventurePredictionPersistence: vi.fn(() => vi.fn()),
  createSupabaseRoutePredictionClient: vi.fn(() => ({ routePrediction: true })),
  getAdventurePlan: vi.fn(),
  getStoredPerformanceProfile: vi.fn(async () => null),
}));
vi.mock('@/features/adventure-intelligence/server/featureFlags', () => ({
  currentAdventureFeatureFlags: vi.fn(async () => ({
    performance_profile_v2: false,
    route_prediction_v2: false,
  })),
}));

import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  generateAdventure,
  getAdventurePlan,
} from '@/features/adventure-intelligence/server/generateAdventure';
import {
  evaluateGenerationRequest,
  GENERATION_QUOTA_PER_HOUR,
  GENERATION_QUOTA_WINDOW_S,
  type ExistingGenerationRequest,
} from '@/features/adventure-intelligence/domain/generationLimits';
import { POST as generatePOST } from '@/app/api/adventure/generate/route';

const USER_ID = 'a6000000-0000-4000-8000-0000000000dd';
const PLAN_ID = 'a6000000-0000-4000-8000-0000000000ee';
const KEY = 'idem-key-0001';

const mockedCreateClient = vi.mocked(createClient);
const mockedService = vi.mocked(getServiceSupabase);
const mockedGenerate = vi.mocked(generateAdventure);
const mockedGetPlan = vi.mocked(getAdventurePlan);

function sessionClient(user: { id: string } | null) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
  } as never;
}

function generateRequest(
  body: unknown,
  options: { idempotencyKey?: string | null } = {}
): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.idempotencyKey !== null) {
    headers['idempotency-key'] = options.idempotencyKey ?? KEY;
  }
  return new NextRequest('http://localhost/api/adventure/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

const TEXT = 'Un trek de sept jours au Mont-Blanc en juillet';

function resetStore(): void {
  mocks.store.findByKey.mockReset().mockResolvedValue(null);
  mocks.store.hasActivePending.mockReset().mockResolvedValue(false);
  mocks.store.countRecent.mockReset().mockResolvedValue(0);
  mocks.store.createPending.mockReset().mockResolvedValue({ id: 'req-1' });
  mocks.store.markDone.mockReset().mockResolvedValue(undefined);
  mocks.store.markFailed.mockReset().mockResolvedValue(undefined);
}

describe('A10 — Quotas et idempotence de génération (TEST-A10-GEN, pur)', () => {
  it('TEST-A10-GEN-01: sans requête existante ni attente ni quota ⇒ proceed', () => {
    expect(
      evaluateGenerationRequest({ existing: null, activePending: false, recentCount: 0 })
    ).toEqual({ decision: 'proceed' });

    expect(
      evaluateGenerationRequest({ existing: null, activePending: false, recentCount: 4 })
    ).toEqual({ decision: 'proceed' });
    expect(GENERATION_QUOTA_PER_HOUR).toBe(5);
  });

  it('TEST-A10-GEN-02: une clé déjà traitée est réutilisée, jamais régénérée', () => {
    const done: ExistingGenerationRequest = { status: 'done', planId: PLAN_ID };
    expect(
      evaluateGenerationRequest({ existing: done, activePending: false, recentCount: 9 })
    ).toEqual({ decision: 'reuse', planId: PLAN_ID });

    expect(
      evaluateGenerationRequest({
        existing: { status: 'done', planId: null },
        activePending: false,
        recentCount: 0,
      })
    ).toEqual({ decision: 'conflict' });
  });

  it('TEST-A10-GEN-03: une génération active bloque (même clé pending ou autre pending)', () => {
    expect(
      evaluateGenerationRequest({
        existing: { status: 'pending', planId: null },
        activePending: false,
        recentCount: 0,
      })
    ).toEqual({ decision: 'conflict' });

    expect(
      evaluateGenerationRequest({ existing: null, activePending: true, recentCount: 0 })
    ).toEqual({ decision: 'conflict' });

    expect(
      evaluateGenerationRequest({
        existing: { status: 'failed', planId: null },
        activePending: false,
        recentCount: 1,
      })
    ).toEqual({ decision: 'proceed' });
  });

  it('TEST-A10-GEN-04: quota 5/h ⇒ 429 avec Retry-After, quota paramétrable', () => {
    expect(
      evaluateGenerationRequest({ existing: null, activePending: false, recentCount: 5 })
    ).toEqual({ decision: 'rate_limited', retryAfterS: GENERATION_QUOTA_WINDOW_S });
    expect(GENERATION_QUOTA_WINDOW_S).toBe(3600);

    expect(
      evaluateGenerationRequest({
        existing: null,
        activePending: false,
        recentCount: 2,
        quotaPerHour: 2,
      })
    ).toEqual({ decision: 'rate_limited', retryAfterS: GENERATION_QUOTA_WINDOW_S });

    expect(
      evaluateGenerationRequest({
        existing: null,
        activePending: false,
        recentCount: 2,
        quotaPerHour: 3,
      })
    ).toEqual({ decision: 'proceed' });
  });
});

describe('A10 — Route generate durcie (TEST-A10-GEN, route mockée)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockedService.mockReturnValue({} as never);
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
  });

  it('TEST-A10-GEN-05: Idempotency-Key requis (400) ; conflit (409) ; quota (429 + Retry-After)', async () => {
    const missing = await generatePOST(
      generateRequest({ text: TEXT }, { idempotencyKey: null })
    );
    expect(missing.status).toBe(400);
    const missingBody = await missing.json();
    expect(String(missingBody.details)).toContain('Idempotency-Key');
    expect(mockedGenerate).not.toHaveBeenCalled();

    mocks.store.hasActivePending.mockResolvedValue(true);
    const conflict = await generatePOST(generateRequest({ text: TEXT }));
    expect(conflict.status).toBe(409);
    expect(mockedGenerate).not.toHaveBeenCalled();

    resetStore();
    mocks.store.countRecent.mockResolvedValue(GENERATION_QUOTA_PER_HOUR);
    const limited = await generatePOST(generateRequest({ text: TEXT }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe(String(GENERATION_QUOTA_WINDOW_S));
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('TEST-A10-GEN-06: clé traitée ⇒ réponse réutilisée sans régénérer (200)', async () => {
    mocks.store.findByKey.mockResolvedValue({ id: 'req-0', status: 'done', planId: PLAN_ID });
    mockedGetPlan.mockResolvedValue({
      plan: {
        id: PLAN_ID,
        currentVersion: 3,
        sections: { alternatives: { value: [{ id: 'comfort' }] } },
      } as never,
      version: null,
      decisions: [],
      candidates: [],
      candidateComparison: null,
    });

    const response = await generatePOST(generateRequest({ text: TEXT }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ planId: PLAN_ID, version: 3, reused: true, aiUsed: false });
    expect(body.candidates).toHaveLength(1);
    expect(mockedGenerate).not.toHaveBeenCalled();
    expect(mocks.store.createPending).not.toHaveBeenCalled();
  });

  it('TEST-A10-GEN-06b: génération réelle ⇒ pending créé puis done avec plan_id (201)', async () => {
    mockedGenerate.mockResolvedValue({
      plan: { id: PLAN_ID, currentVersion: 1 } as never,
      candidates: [{ id: 'comfort' }, { id: 'balanced' }, { id: 'adventure' }] as never,
      candidatePlans: [],
      candidateComparison: {
        planId: PLAN_ID,
        sharedRoute: true,
        sharedDates: true,
        sharedAccommodations: true,
        segmentation: 'uniform_from_blueprint',
        routeTotalDistanceKm: null,
        rows: [],
        generatedAt: new Date().toISOString(),
      },
      runs: [],
      explanation: 'Résumé déterministe.',
      aiUsed: false,
    });

    const response = await generatePOST(generateRequest({ text: TEXT }));

    expect(response.status).toBe(201);
    expect(mocks.store.createPending).toHaveBeenCalledWith(USER_ID, KEY);
    expect(mocks.store.markDone).toHaveBeenCalledWith('req-1', PLAN_ID);
    expect(mocks.store.markFailed).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body).toMatchObject({ planId: PLAN_ID, version: 1 });
  });

  it('TEST-A10-GEN-06c: échec de génération ⇒ requête marquée failed, erreur 500', async () => {
    mockedGenerate.mockRejectedValue(new Error('moteur indisponible'));

    const response = await generatePOST(generateRequest({ text: TEXT }));

    expect(response.status).toBe(500);
    expect(mocks.store.markFailed).toHaveBeenCalledWith('req-1');
    expect(mocks.store.markDone).not.toHaveBeenCalled();
  });

  it('TEST-A10-GEN-06d: course de clé/actif ⇒ createPending conflictuel renvoie 409', async () => {
    mocks.store.createPending.mockResolvedValue(null);

    const response = await generatePOST(generateRequest({ text: TEXT }));

    expect(response.status).toBe(409);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });
});
