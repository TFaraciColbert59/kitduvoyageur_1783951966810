/**
 * A13 (S3) — Route billing + gating `full_generation` sur generate.
 *
 *   • TEST-A13-ENT-10 : GET /api/billing/entitlements 401 sans session.
 *   • TEST-A13-ENT-11 : Stripe non configuré ⇒ `configured:false` explicite,
 *     aucun prix inventé, plan free par défaut.
 *   • TEST-A13-ENT-12 : plan/passes réels exposés avec leur source ; secrets
 *     jamais renvoyés.
 *   • TEST-A13-ENT-13 : service indisponible ⇒ état `unavailable` (jamais 500).
 *   • TEST-A13-ENT-14 : generate free ⇒ quota réduit explicite (429 avec palier)
 *     sans bloquer sous le palier ; plan payant ⇒ quota standard.
 */
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

const serviceMock = vi.hoisted(() => ({}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceMock),
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
vi.mock('@/lib/entitlements/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/entitlements/server')>();
  return { ...actual, resolveUserEntitlements: vi.fn() };
});

import { createClient } from '@/lib/supabase/server';
import { generateAdventure } from '@/features/adventure-intelligence/server/generateAdventure';
import { resolveUserEntitlements } from '@/lib/entitlements/server';
import type { Entitlement } from '@/features/adventure-intelligence/domain/entitlements';
import { GET as billingGET } from '@/app/api/billing/entitlements/route';
import { POST as generatePOST } from '@/app/api/adventure/generate/route';

const USER_ID = 'a1330000-0000-4000-8000-0000000000a1';
const PLAN_ID = 'a1330000-0000-4000-8000-0000000000a2';

const mockedCreateClient = vi.mocked(createClient);
const mockedResolve = vi.mocked(resolveUserEntitlements);
const mockedGenerate = vi.mocked(generateAdventure);

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function generateRequest(): NextRequest {
  return new NextRequest('http://localhost/api/adventure/generate', {
    method: 'POST',
    body: JSON.stringify({ text: 'Un trek de sept jours au Mont-Blanc en juillet' }),
    headers: { 'content-type': 'application/json', 'idempotency-key': 's3-ent-key' },
  });
}

function resolvedFree() {
  return {
    plan: 'free' as const,
    activePasses: [],
    entitlements: [],
    source: 'default_free' as const,
    configured: false,
  };
}

function resolvedPaid() {
  return {
    plan: 'explorer' as const,
    activePasses: [],
    entitlements: ['full_generation', 'advanced_profile', 'history'] as Entitlement[],
    source: 'user_entitlements' as const,
    configured: false,
  };
}

describe('A13 (S3) — billing et quota de génération', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    storeMock.findByKey.mockResolvedValue(null);
    storeMock.hasActivePending.mockResolvedValue(false);
    storeMock.countRecent.mockResolvedValue(0);
    storeMock.createPending.mockResolvedValue({ id: 'req-s3' });
    storeMock.markDone.mockResolvedValue(undefined);
    storeMock.markFailed.mockResolvedValue(undefined);
  });

  it('TEST-A13-ENT-10: billing exige une session (401)', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));
    const response = await billingGET(new NextRequest('http://localhost/api/billing/entitlements'));
    expect(response.status).toBe(401);
  });

  it('TEST-A13-ENT-11: Stripe non configuré ⇒ configured:false, free par défaut', async () => {
    mockedResolve.mockResolvedValue(resolvedFree());

    const response = await billingGET(new NextRequest('http://localhost/api/billing/entitlements'));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.configured).toBe(false);
    expect(body.plan).toBe('free');
    expect(body.source).toBe('default_free');
    expect(body.entitlements).toEqual([]);
    expect(body.activePasses).toEqual([]);
    expect(body.stripe.secretKey).toBe(false);
    expect(Object.values(body.stripe.priceIds).every((value) => value === false)).toBe(true);

    // Aucun prix, aucune clé : uniquement des booléens.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('price_');
    expect(serialized).not.toContain('sk_');
  });

  it('TEST-A13-ENT-12: plan/passes réels exposés avec leur source, sans secret', async () => {
    mockedResolve.mockResolvedValue({
      plan: 'expedition',
      activePasses: ['weekend'],
      entitlements: ['full_generation', 'offline', 'trek'],
      source: 'stripe_metadata',
      configured: true,
    });

    const response = await billingGET(new NextRequest('http://localhost/api/billing/entitlements'));
    const body = await response.json();
    expect(body).toMatchObject({
      configured: true,
      plan: 'expedition',
      source: 'stripe_metadata',
      activePasses: ['weekend'],
    });
    expect(body.entitlements).toContain('trek');
  });

  it('TEST-A13-ENT-13: service indisponible ⇒ état unavailable explicite', async () => {
    mockedResolve.mockResolvedValue({
      plan: 'free',
      activePasses: [],
      entitlements: [],
      source: 'unavailable',
      configured: false,
    });

    const response = await billingGET(new NextRequest('http://localhost/api/billing/entitlements'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe('unavailable');
    expect(body.plan).toBe('free');
  });

  it('TEST-A13-ENT-14: quota free réduit sans bloquer les usages gratuits', async () => {
    mockedResolve.mockResolvedValue(resolvedFree());

    storeMock.countRecent.mockResolvedValue(1);
    mockedGenerate.mockResolvedValue({
      plan: { id: PLAN_ID, currentVersion: 1 } as never,
      candidates: [] as never,
      candidatePlans: [],
      candidateComparison: {
        planId: PLAN_ID,
        sharedRoute: true,
        sharedDates: true,
        sharedAccommodations: true,
        segmentation: 'uniform_from_blueprint',
        routeTotalDistanceKm: null,
        rows: [],
        generatedAt: '2026-09-11T12:00:00.000Z',
      },
      runs: [],
      explanation: 'ok',
      aiUsed: false,
    });
    const underQuota = await generatePOST(generateRequest());
    expect(underQuota.status).toBe(201);
    expect(mockedGenerate).toHaveBeenCalledTimes(1);

    mockedGenerate.mockClear();
    storeMock.countRecent.mockResolvedValue(2);
    const atQuota = await generatePOST(generateRequest());
    expect(atQuota.status).toBe(429);
    const body = await atQuota.json();
    expect(body.quotaPerHour).toBe(2);
    expect(String(body.details)).toMatch(/gratuit|plan/i);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('TEST-A13-ENT-15: plan payant ⇒ quota standard (pas de blocage à 2)', async () => {
    mockedResolve.mockResolvedValue(resolvedPaid());
    storeMock.countRecent.mockResolvedValue(2);
    mockedGenerate.mockResolvedValue({
      plan: { id: PLAN_ID, currentVersion: 1 } as never,
      candidates: [] as never,
      candidatePlans: [],
      candidateComparison: {
        planId: PLAN_ID,
        sharedRoute: true,
        sharedDates: true,
        sharedAccommodations: true,
        segmentation: 'uniform_from_blueprint',
        routeTotalDistanceKm: null,
        rows: [],
        generatedAt: '2026-09-11T12:00:00.000Z',
      },
      runs: [],
      explanation: 'ok',
      aiUsed: false,
    });

    const response = await generatePOST(generateRequest());
    expect(response.status).toBe(201);
    expect(mockedGenerate).toHaveBeenCalledTimes(1);
  });
});
