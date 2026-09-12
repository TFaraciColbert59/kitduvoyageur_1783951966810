import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const storeMock = vi.hoisted(() => ({
  findByKey: vi.fn(),
  hasActivePending: vi.fn(),
  countRecent: vi.fn(),
  createPending: vi.fn(),
  markDone: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => ({})),
}));
vi.mock('@/features/adventure-intelligence/server/generationRequests', () => ({
  createSupabaseGenerationRequestStore: vi.fn(() => storeMock),
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

import { createClient } from '@/lib/supabase/server';
import { generateAdventure } from '@/features/adventure-intelligence/server/generateAdventure';
import { POST as generatePOST } from '@/app/api/adventure/generate/route';

const USER_ID = 'a6000000-0000-4000-8000-0000000000dd';
const PLAN_ID = 'a6000000-0000-4000-8000-0000000000ee';
const HEADER_ID = 'c3000000-0000-4000-8000-0000000000cc';
const BODY_ID = 'd4000000-0000-4000-8000-0000000000dd';
const INVALID = 'pas-un-uuid';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mockedCreateClient = vi.mocked(createClient);
const mockedGenerate = vi.mocked(generateAdventure);

function sessionClient(user: { id: string } | null) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
  } as never;
}

function generateRequest(body: unknown, correlationHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/adventure/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'a6-api-test-key',
      ...(correlationHeader ? { 'x-correlation-id': correlationHeader } : {}),
    },
  });
}

function generatedResult(correlationId: string) {
  return {
    plan: { id: PLAN_ID, currentVersion: 1 },
    candidates: [],
    candidatePlans: [],
    candidateComparison: undefined,
    runs: [],
    explanation: 'Résumé déterministe.',
    aiUsed: false,
    correlationId,
  } as never;
}

describe('Phase 10 — corrélation des routes (TEST-P10-ROUTE)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    storeMock.findByKey.mockResolvedValue(null);
    storeMock.hasActivePending.mockResolvedValue(false);
    storeMock.countRecent.mockResolvedValue(0);
    storeMock.createPending.mockResolvedValue({ id: 'req-p10' });
    storeMock.markDone.mockResolvedValue(undefined);
    storeMock.markFailed.mockResolvedValue(undefined);
  });

  it('TEST-P10-ROUTE-01: en-tête x-correlation-id valide propagé à la génération et renvoyé', async () => {
    mockedGenerate.mockResolvedValue(generatedResult(HEADER_ID));

    const response = await generatePOST(
      generateRequest({ text: 'Un trek de sept jours au Mont-Blanc' }, HEADER_ID)
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('x-correlation-id')).toBe(HEADER_ID);
    const body = await response.json();
    expect(body.correlationId).toBe(HEADER_ID);
    expect(mockedGenerate.mock.calls[0][0]).toMatchObject({ correlationId: HEADER_ID });
  });

  it('TEST-P10-ROUTE-02: en-tête invalide remplacé par un UUID généré (jamais recopié)', async () => {
    mockedGenerate.mockImplementation(async (input) => generatedResult(String(input.correlationId)));

    const response = await generatePOST(
      generateRequest({ text: 'Un trek de sept jours au Mont-Blanc' }, INVALID)
    );

    expect(response.status).toBe(201);
    const passed = mockedGenerate.mock.calls[0][0].correlationId as string;
    expect(passed).not.toBe(INVALID);
    expect(UUID_PATTERN.test(passed)).toBe(true);
    expect(response.headers.get('x-correlation-id')).toBe(passed);
  });

  it('TEST-P10-ROUTE-03: le corps (chaîne) prime sur l’en-tête de transport', async () => {
    mockedGenerate.mockImplementation(async (input) => generatedResult(String(input.correlationId)));

    const response = await generatePOST(
      generateRequest({ text: 'Un trek de sept jours au Mont-Blanc', correlationId: BODY_ID }, HEADER_ID)
    );

    expect(response.status).toBe(201);
    expect(mockedGenerate.mock.calls[0][0]).toMatchObject({ correlationId: BODY_ID });
    expect(response.headers.get('x-correlation-id')).toBe(BODY_ID);
  });
});
