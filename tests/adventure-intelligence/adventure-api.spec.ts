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
  getAdventurePlan: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { generateAdventure, getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';
import { POST as generatePOST } from '@/app/api/adventure/generate/route';
import { GET as planGET } from '@/app/api/adventure/[id]/route';

const USER_ID = 'a6000000-0000-4000-8000-0000000000dd';
const PLAN_ID = 'a6000000-0000-4000-8000-0000000000ee';
const NOW = '2026-09-11T10:00:00.000Z';

const mockedCreateClient = vi.mocked(createClient);
const mockedService = vi.mocked(getServiceSupabase);
const mockedGenerate = vi.mocked(generateAdventure);
const mockedGetPlan = vi.mocked(getAdventurePlan);

function sessionClient(user: { id: string } | null) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
  } as never;
}

function generateRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/adventure/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      // A10 (10.8) : l'idempotence exige désormais cet en-tête.
      'idempotency-key': 'a6-api-test-key',
    },
  });
}

function planRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/adventure/${id}`, { method: 'GET' });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('A6 — API génération et lecture (TEST-A6-API)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedService.mockReturnValue({} as never);
    storeMock.findByKey.mockResolvedValue(null);
    storeMock.hasActivePending.mockResolvedValue(false);
    storeMock.countRecent.mockResolvedValue(0);
    storeMock.createPending.mockResolvedValue({ id: 'req-a6' });
    storeMock.markDone.mockResolvedValue(undefined);
    storeMock.markFailed.mockResolvedValue(undefined);
  });

  it('TEST-A6-API-01: POST generate exige une session (401)', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await generatePOST(generateRequest({ text: 'Un trek de sept jours au Mont-Blanc' }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('TEST-A6-API-02: POST generate valide l’entrée zod et le service (400/503)', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const short = await generatePOST(generateRequest({ text: 'court' }));
    expect(short.status).toBe(400);
    const shortBody = await short.json();
    expect(shortBody.error).toBe('Corps invalide');
    expect(String(shortBody.details)).toContain('text');

    mockedService.mockReturnValue(null as never);
    const unavailable = await generatePOST(generateRequest({ text: 'Un trek de sept jours au Mont-Blanc' }));
    expect(unavailable.status).toBe(503);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('TEST-A6-API-03: POST generate retourne 201 avec plan, variantes et explication', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedGenerate.mockResolvedValue({
      plan: { id: PLAN_ID, currentVersion: 1 } as never,
      candidates: [{ id: 'comfort' }, { id: 'balanced' }, { id: 'adventure' }] as never,
      runs: [],
      explanation: 'Résumé déterministe.',
      aiUsed: false,
    });

    const response = await generatePOST(generateRequest({ text: 'Un trek de sept jours au Mont-Blanc en juillet' }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      planId: PLAN_ID,
      version: 1,
      explanation: 'Résumé déterministe.',
      aiUsed: false,
    });
    expect(body.candidates).toHaveLength(3);
    expect(mockedGenerate).toHaveBeenCalledTimes(1);
    expect(mockedGenerate.mock.calls[0][0]).toMatchObject({
      ownerId: USER_ID,
      text: 'Un trek de sept jours au Mont-Blanc en juillet',
    });
  });

  it('TEST-A6-API-04: GET lit plan + version + décisions, 404 sinon', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));
    expect((await planGET(planRequest(PLAN_ID), params(PLAN_ID))).status).toBe(404);

    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedGetPlan.mockResolvedValue(null);
    expect((await planGET(planRequest(PLAN_ID), params(PLAN_ID))).status).toBe(404);

    mockedGetPlan.mockResolvedValue({
      plan: { id: PLAN_ID } as never,
      version: { version: 1 } as never,
      decisions: [{ id: 'decision-1' }] as never,
    });
    const response = await planGET(planRequest(PLAN_ID), params(PLAN_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.plan.id).toBe(PLAN_ID);
    expect(body.version.version).toBe(1);
    expect(body.decisions).toHaveLength(1);
  });
});
