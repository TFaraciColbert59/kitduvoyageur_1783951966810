/**
 * Chantier configurateur — L0.6 (relecture) et L0.7 (modification).
 *
 * GET /api/adventure/[id] restitue le plan accepté ; PUT ajoute une nouvelle
 * version immuable, propriétaire uniquement, avec verrou optimiste.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  appendVersion: vi.fn(),
  update: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  rateLimitHeaders: () => ({}),
}));
vi.mock('@/features/adventure-intelligence/server/generateAdventure', () => ({
  getAdventurePlan: vi.fn(),
}));
vi.mock('@/features/adventure-intelligence/server/groupTrek', () => ({
  createSupabaseGroupTrekDataSource: vi.fn(() => ({ appendVersion: mocks.appendVersion })),
}));

import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';
import { GET, PUT } from '@/app/api/adventure/[id]/route';
import {
  buildAcceptedPlanEditVersion,
  changedFoundations,
} from '@/features/adventure-intelligence/domain/acceptedPlanEdit';
import { buildAcceptedPlan } from '@/features/adventure-prep/adventureRequest';
import { draftFromAcceptedPlan, parseAcceptedPlan } from '@/features/adventure-prep/acceptedPlan';
import { fullDraft } from '@/features/adventure-prep/__tests__/fixtures';
import type { AdventurePlan } from '@/features/adventure-intelligence/domain/adventurePlan';

const OWNER = 'c0000000-0000-4000-8000-000000000001';
const OTHER = 'c0000000-0000-4000-8000-000000000002';
const PLAN_ID = 'c0000000-0000-4000-8000-0000000000aa';
const NOW = '2026-09-30T10:00:00.000Z';

const mockedCreateClient = vi.mocked(createClient);
const mockedService = vi.mocked(getServiceSupabase);
const mockedGetPlan = vi.mocked(getAdventurePlan);

const ACCEPTED = buildAcceptedPlan(
  fullDraft({
    coverName: 'Trois jours de refuge',
    calendar: { startDate: '2027-07-11', durationDays: 3, durationIsSuggested: false, returnDate: '2027-07-13' },
  })
);

function plan(overrides: Partial<AdventurePlan> = {}): AdventurePlan {
  return {
    id: PLAN_ID,
    ownerId: OWNER,
    title: 'Aventure — Chamonix',
    currentVersion: 1,
    confidence: { score: 0.5 },
    ...overrides,
  } as unknown as AdventurePlan;
}

function stored(options: { version?: number; snapshot?: Record<string, unknown>; ownerId?: string } = {}) {
  const current = plan({ ownerId: options.ownerId ?? OWNER, currentVersion: options.version ?? 1 });
  return {
    plan: current,
    version: {
      version: options.version ?? 1,
      snapshot: options.snapshot ?? { ...current, candidates: [{ id: 'c1' }], acceptedPlan: ACCEPTED },
      reason: 'Génération initiale (A6)',
      generatedBy: 'a6-orchestrator',
      confidence: current.confidence,
      createdAt: NOW,
    },
    decisions: [],
    candidates: [],
    candidateComparison: null,
    acceptedPlan: ACCEPTED,
  };
}

function session(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function serviceClient() {
  const eqOwner = vi.fn(async () => ({ error: null }));
  const eqId = vi.fn(() => ({ eq: eqOwner }));
  mocks.update.mockImplementation(() => ({ eq: eqId }));
  return { from: vi.fn(() => ({ update: mocks.update })) } as never;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function putRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/adventure/${PLAN_ID}`, {
    method: 'PUT',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateClient.mockResolvedValue(session({ id: OWNER }));
  mockedService.mockReturnValue(serviceClient());
  mocks.rateLimit.mockResolvedValue({ outcome: 'allowed', allowed: true });
  mocks.appendVersion.mockResolvedValue(2);
});

describe('L0.6 — GET restitue le plan accepté', () => {
  it('CU-GET-01: acceptedPlan et canEdit présents pour le propriétaire', async () => {
    mockedGetPlan.mockResolvedValue(stored() as never);
    const response = await GET(new NextRequest('http://localhost'), params(PLAN_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.acceptedPlan).toEqual(ACCEPTED);
    expect(body.canEdit).toBe(true);
  });

  it('CU-GET-02: aller-retour brouillon → POST → GET → brouillon identique', async () => {
    mockedGetPlan.mockResolvedValue(stored() as never);
    const body = await (await GET(new NextRequest('http://localhost'), params(PLAN_ID))).json();
    const reread = parseAcceptedPlan(body.acceptedPlan);
    expect(reread).not.toBeNull();
    expect(buildAcceptedPlan(draftFromAcceptedPlan(reread!))).toEqual(ACCEPTED);
  });

  it('CU-GET-03: collaborateur lit sans pouvoir modifier', async () => {
    mockedCreateClient.mockResolvedValue(session({ id: OTHER }));
    mockedGetPlan.mockResolvedValue(stored() as never);
    const body = await (await GET(new NextRequest('http://localhost'), params(PLAN_ID))).json();
    expect(body.canEdit).toBe(false);
  });
});

describe('L0.7 — PUT enregistre une nouvelle version', () => {
  it('CU-PUT-01: sans session ⇒ 401, rien n’est écrit', async () => {
    mockedCreateClient.mockResolvedValue(session(null));
    const response = await PUT(putRequest({ expectedVersion: 1, acceptedPlan: ACCEPTED }), params(PLAN_ID));
    expect(response.status).toBe(401);
    expect(mocks.appendVersion).not.toHaveBeenCalled();
  });

  it('CU-PUT-02: plan d’autrui ⇒ 404 (aucune fuite), rien n’est écrit', async () => {
    mockedGetPlan.mockResolvedValue(stored({ ownerId: OTHER }) as never);
    const response = await PUT(putRequest({ expectedVersion: 1, acceptedPlan: ACCEPTED }), params(PLAN_ID));
    expect(response.status).toBe(404);
    expect(mocks.appendVersion).not.toHaveBeenCalled();
  });

  it('CU-PUT-03: corps invalide ou plan malformé ⇒ 400', async () => {
    mockedGetPlan.mockResolvedValue(stored() as never);
    expect((await PUT(putRequest('{'), params(PLAN_ID))).status).toBe(400);
    expect(
      (await PUT(putRequest({ expectedVersion: 1, acceptedPlan: { ...ACCEPTED, schemaVersion: 2 } }), params(PLAN_ID))).status
    ).toBe(400);
    expect(
      (await PUT(putRequest({ expectedVersion: 1, acceptedPlan: ACCEPTED, admin: true }), params(PLAN_ID))).status
    ).toBe(400);
    expect(mocks.appendVersion).not.toHaveBeenCalled();
  });

  it('CU-PUT-04: version périmée ⇒ 409 avec la version courante', async () => {
    mockedGetPlan.mockResolvedValue(stored({ version: 3 }) as never);
    const response = await PUT(putRequest({ expectedVersion: 2, acceptedPlan: ACCEPTED }), params(PLAN_ID));
    expect(response.status).toBe(409);
    expect((await response.json()).currentVersion).toBe(3);
    expect(mocks.appendVersion).not.toHaveBeenCalled();
  });

  it('CU-PUT-05: succès ⇒ version ajoutée, snapshot précédent conservé', async () => {
    mockedGetPlan.mockResolvedValue(stored() as never);
    const next = { ...ACCEPTED, coverName: 'Refuges du Mont-Blanc' };
    const response = await PUT(putRequest({ expectedVersion: 1, acceptedPlan: next }), params(PLAN_ID));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ planId: PLAN_ID, version: 2 });
    const call = mocks.appendVersion.mock.calls[0][0];
    expect(call).toMatchObject({ planId: PLAN_ID, userId: OWNER });
    expect(call.version.reason).toBe('prep-edited');
    expect(call.version.snapshot.acceptedPlan).toEqual(next);
    expect(call.version.snapshot.candidates).toEqual([{ id: 'c1' }]);
    expect(call.version.snapshot.title).toBe('Refuges du Mont-Blanc');
    expect(mocks.update).toHaveBeenCalledWith({ title: 'Refuges du Mont-Blanc' });
  });

  it('CU-PUT-06: rafale ⇒ 429, rien n’est écrit', async () => {
    mocks.rateLimit.mockResolvedValue({ outcome: 'limited', allowed: false, retryAfterSeconds: 30 });
    const response = await PUT(putRequest({ expectedVersion: 1, acceptedPlan: ACCEPTED }), params(PLAN_ID));
    expect(response.status).toBe(429);
    expect(mocks.appendVersion).not.toHaveBeenCalled();
  });

  it('CU-PUT-07: échec d’écriture ⇒ 500 sans détail technique', async () => {
    mockedGetPlan.mockResolvedValue(stored() as never);
    mocks.appendVersion.mockRejectedValue(new Error('permission denied for function'));
    const response = await PUT(putRequest({ expectedVersion: 1, acceptedPlan: ACCEPTED }), params(PLAN_ID));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('permission');
  });
});

describe('L0.7 — sections calculées : périmées si leurs fondements changent', () => {
  it('CU-EDIT-01: simple renommage ⇒ sections toujours valides', () => {
    expect(changedFoundations(ACCEPTED, { ...ACCEPTED, coverName: 'Autre nom' })).toEqual([]);
  });

  it('CU-EDIT-02: date, durée ou groupe changés ⇒ sections périmées, annoncées', () => {
    const next = {
      ...ACCEPTED,
      calendar: { ...ACCEPTED.calendar, startDate: '2027-08-01', durationDays: 5 },
      group: { ...ACCEPTED.group, adults: 4 },
    };
    const { meta } = buildAcceptedPlanEditVersion({
      plan: plan(),
      latestSnapshot: { acceptedPlan: ACCEPTED },
      previousAccepted: ACCEPTED,
      nextAccepted: next,
      now: NOW,
    });
    expect(meta.sectionsStale).toBe(true);
    expect(meta.changedFoundations).toEqual(['dates', 'duree', 'groupe']);
  });

  it('CU-EDIT-03: une fois périmées, les sections le restent jusqu’au recalcul', () => {
    const { meta } = buildAcceptedPlanEditVersion({
      plan: plan(),
      latestSnapshot: { acceptedPlanMeta: { editedAt: NOW, sectionsStale: true, changedFoundations: ['dates'] } },
      previousAccepted: ACCEPTED,
      nextAccepted: ACCEPTED,
      now: NOW,
    });
    expect(meta.sectionsStale).toBe(true);
  });

  it('CU-EDIT-04: plan sans contrat antérieur ⇒ jamais présumé à jour', () => {
    expect(changedFoundations(null, ACCEPTED)).toHaveLength(5);
  });
});
