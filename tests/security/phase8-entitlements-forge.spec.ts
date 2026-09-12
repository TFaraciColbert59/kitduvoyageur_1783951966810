/**
 * Phase 8 — Les entitlements sont calculés CÔTÉ SERVEUR uniquement.
 *
 *   TEST-PHASE8-ENT-FORGE-01 : paramètres/entêtes client forgés ignorés,
 *                              le plan vient exclusivement de la table
 *                              `user_entitlements` (service_role).
 *   TEST-PHASE8-ENT-FORGE-02 : la réponse ne divulgue aucun secret ni prix,
 *                              uniquement des booléens de configuration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { GET } from '@/app/api/billing/entitlements/route';

const USER_ID = 'a1330000-0000-4000-8000-0000000000f1';

const SAVED = {
  secret: process.env.STRIPE_SECRET_KEY,
  price: process.env.STRIPE_PRICE_EXPLORER,
};

function mockSession(user: { id: string } | null): void {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as never);
}

function mockEntitlementRow(row: unknown): void {
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  vi.mocked(getServiceSupabase).mockReturnValue({ from: vi.fn(() => ({ select })) } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_EXPLORER;
  delete process.env.STRIPE_PRICE_EXPEDITION;
  delete process.env.STRIPE_PRICE_GROUP;
  delete process.env.STRIPE_PRICE_PASS_WEEKEND;
  delete process.env.STRIPE_PRICE_PASS_TRIP;
  delete process.env.STRIPE_PRICE_PASS_EXPEDITION;
  mockSession({ id: USER_ID });
});

afterEach(() => {
  if (SAVED.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = SAVED.secret;
  if (SAVED.price === undefined) delete process.env.STRIPE_PRICE_EXPLORER;
  else process.env.STRIPE_PRICE_EXPLORER = SAVED.price;
});

describe('Phase 8 — entitlements infalsifiables côté client', () => {
  it('TEST-PHASE8-ENT-FORGE-01: paramètres forgés ignorés, plan serveur `free`', async () => {
    mockEntitlementRow({ plan: 'free', active_passes: [], source: 'user_entitlements' });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/billing/entitlements?plan=expedition&passes=weekend&entitlements=full_generation`,
        { headers: { 'x-plan': 'group', 'x-entitlements': 'offline,trek' } }
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.plan).toBe('free');
    expect(body.activePasses).toEqual([]);
    expect(body.entitlements).toEqual([]);
    expect(body.source).toBe('user_entitlements');
  });

  it('TEST-PHASE8-ENT-FORGE-02: un client ne peut pas rétrograder un plan serveur, aucun secret exposé', async () => {
    mockEntitlementRow({
      plan: 'explorer',
      active_passes: ['weekend'],
      source: 'stripe_metadata',
    });

    const response = await GET(
      new NextRequest('http://localhost/api/billing/entitlements?plan=free')
    );

    const body = await response.json();
    expect(body.plan).toBe('explorer');
    expect(body.activePasses).toEqual(['weekend']);
    expect(body.source).toBe('stripe_metadata');
    expect(body.configured).toBe(false);
    expect(Object.values(body.stripe.priceIds).every((v) => v === false)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/price_|sk_|whsec_/);
  });
});
