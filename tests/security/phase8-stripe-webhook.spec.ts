/**
 * Phase 8 — Webhook Stripe robuste (signature + idempotence), tests MOCKÉS.
 *
 * Aucun appel réseau, aucune clé réelle : le module `stripe` est remplacé par
 * un faux client local et Supabase par un faux service_role. Couvre :
 *   TEST-PHASE8-STRIPE-01  refus sans secret webhook (503)
 *   TEST-PHASE8-STRIPE-02  signature invalide (400), rien n'est réservé
 *   TEST-PHASE8-STRIPE-03  type inconnu acquitté `ignored`, journalisé
 *   TEST-PHASE8-STRIPE-04  doublon d'événement : acquittement sans retraitement
 *   TEST-PHASE8-STRIPE-05  paiement : commande + articles + déstockage + grant
 *   TEST-PHASE8-STRIPE-06  renouvellement : grant depuis metadata serveur
 *   TEST-PHASE8-STRIPE-07  échec de paiement : journalisé, aucun effet métier
 *   TEST-PHASE8-STRIPE-08  remboursement : reverse de commission
 *   TEST-PHASE8-STRIPE-09  annulation d'abonnement : acquittée sans écriture
 *   TEST-PHASE8-STRIPE-10  échec de traitement : libération idempotence + 500
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase, type FakeSupabaseConfig } from '../mocks/fakeSupabaseStripe';

const stripeMock = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieve: vi.fn(),
  list: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));
const grantMock = vi.hoisted(() => vi.fn(async () => ({ applied: true })));

vi.mock('stripe', () => ({
  default: class FakeStripe {
    webhooks = { constructEvent: stripeMock.constructEvent };
    checkout = {
      sessions: { retrieve: stripeMock.retrieve, list: stripeMock.list },
    };
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMock.createClient,
}));

vi.mock('@/lib/entitlements/server', () => ({
  grantEntitlementsFromMetadata: grantMock,
}));

import { POST } from '@/app/api/stripe/webhook/route';

const SAVED_ENV = {
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  stripe: process.env.STRIPE_SECRET_KEY,
};

function setEnv(): void {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_phase8_test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-phase8-test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_phase8_fake';
}

function restoreEnv(): void {
  const entries: [string, string | undefined][] = [
    ['STRIPE_WEBHOOK_SECRET', SAVED_ENV.secret],
    ['NEXT_PUBLIC_SUPABASE_URL', SAVED_ENV.url],
    ['SUPABASE_SERVICE_ROLE_KEY', SAVED_ENV.service],
    ['STRIPE_SECRET_KEY', SAVED_ENV.stripe],
  ];
  for (const [key, value] of entries) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function event(type: string, object: Record<string, unknown>, id = 'evt_phase8_1') {
  return { id, type, livemode: false, created: 1_760_000_000, data: { object } };
}

function request(body: string, signature = 't=1,v1=mock'): NextRequest {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
  });
}

function installFake(config: FakeSupabaseConfig = {}) {
  const fake = createFakeSupabase(config);
  supabaseMock.createClient.mockReturnValue(fake.client);
  return fake;
}

const CHECKOUT_SESSION = {
  id: 'cs_test_phase8',
  metadata: {
    user_id: 'a1330000-0000-4000-8000-0000000000a1',
    items: JSON.stringify([{ id: 'prod-1', name: 'Sac test', quantity: 2 }]),
  },
  shipping_details: { address: { city: 'Paris' } },
  amount_subtotal: 5000,
  amount_total: 5000,
};

describe('Phase 8 — webhook Stripe (mocks, zéro réseau)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv();
    stripeMock.retrieve.mockResolvedValue({
      ...CHECKOUT_SESSION,
      line_items: { data: [] },
    });
    stripeMock.list.mockResolvedValue({ data: [{ id: 'cs_test_phase8' }] });
    grantMock.mockResolvedValue({ applied: true });
  });

  afterEach(() => {
    restoreEnv();
  });

  it('TEST-PHASE8-STRIPE-01: sans STRIPE_WEBHOOK_SECRET ⇒ 503, aucun constructEvent', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const response = await POST(request('{}'));

    expect(response.status).toBe(503);
    expect(stripeMock.constructEvent).not.toHaveBeenCalled();
  });

  it('TEST-PHASE8-STRIPE-02: signature invalide ⇒ 400 sans réservation d’événement', async () => {
    stripeMock.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const fake = installFake();

    const response = await POST(request('{"id":"evt_bad"}', 't=1,v1=invalide'));

    expect(response.status).toBe(400);
    expect(fake.calls.inserts).toHaveLength(0);
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it('TEST-PHASE8-STRIPE-03: type inconnu acquitté `ignored` et journalisé', async () => {
    const fake = installFake();
    stripeMock.constructEvent.mockReturnValue(event('payment_intent.created', { id: 'pi_1' }));

    const response = await POST(request('{"id":"evt_phase8_unknown"}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, kind: 'ignored' });
    expect(fake.calls.inserts.map((i) => i.table)).toContain('stripe_events');
    expect(fake.calls.updates.some((u) => u.table === 'stripe_events')).toBe(true);
    expect(fake.calls.inserts.some((i) => i.table === 'orders')).toBe(false);
  });

  it('TEST-PHASE8-STRIPE-04: doublon d’événement ⇒ acquittement sans retraitement', async () => {
    const fake = installFake({ duplicateEvent: true });
    stripeMock.constructEvent.mockReturnValue(event('checkout.session.completed', CHECKOUT_SESSION));

    const response = await POST(request('{"id":"evt_phase8_dup"}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, duplicate: true });
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
    expect(fake.calls.inserts.filter((i) => i.table === 'orders')).toHaveLength(0);
  });

  it('TEST-PHASE8-STRIPE-05: paiement ⇒ commande, articles, déstockage et grant d’entitlement', async () => {
    const fake = installFake({ product: { price_eur: 25, name: 'Sac test', slug: 'sac-test' } });
    stripeMock.constructEvent.mockReturnValue(event('checkout.session.completed', CHECKOUT_SESSION));

    const response = await POST(request('{"id":"evt_phase8_paid"}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, kind: 'checkout_completed' });

    const tables = fake.calls.inserts.map((i) => i.table);
    expect(tables).toContain('stripe_events');
    expect(tables).toContain('orders');
    expect(tables).toContain('order_items');
    const orderRow = fake.calls.inserts.find((i) => i.table === 'orders')?.row;
    expect(orderRow).toMatchObject({
      stripe_session_id: 'cs_test_phase8',
      total_eur: 50,
      user_id: CHECKOUT_SESSION.metadata.user_id,
    });
    expect(fake.calls.rpcs.map((r) => r.fn)).toContain('decrement_stock_on_order');
    expect(grantMock).toHaveBeenCalledWith(expect.anything(), CHECKOUT_SESSION.metadata.user_id, CHECKOUT_SESSION.metadata);
    expect(
      fake.calls.updates.find((u) => u.table === 'stripe_events')?.row
    ).toMatchObject({ status: 'processed' });
  });

  it('TEST-PHASE8-STRIPE-06: renouvellement ⇒ grant depuis les metadata serveur', async () => {
    const fake = installFake();
    stripeMock.constructEvent.mockReturnValue(
      event('invoice.paid', {
        id: 'in_phase8',
        subscription_details: {
          metadata: { user_id: 'a1330000-0000-4000-8000-0000000000a1', plan: 'explorer' },
        },
      })
    );

    const response = await POST(request('{"id":"evt_phase8_renew"}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, kind: 'subscription_renewed' });
    expect(grantMock).toHaveBeenCalledWith(
      expect.anything(),
      'a1330000-0000-4000-8000-0000000000a1',
      { user_id: 'a1330000-0000-4000-8000-0000000000a1', plan: 'explorer' }
    );
    expect(fake.calls.inserts.some((i) => i.table === 'orders')).toBe(false);
  });

  it('TEST-PHASE8-STRIPE-07: échec de paiement ⇒ journalisé, aucun effet métier', async () => {
    const fake = installFake();
    stripeMock.constructEvent.mockReturnValue(
      event('invoice.payment_failed', { id: 'in_failed', customer: 'cus_1' })
    );

    const response = await POST(request('{"id":"evt_phase8_failed"}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, kind: 'payment_failed' });
    expect(grantMock).not.toHaveBeenCalled();
    expect(fake.calls.inserts.some((i) => i.table === 'orders')).toBe(false);
    expect(fake.calls.updates.some((u) => u.table === 'stripe_events')).toBe(true);
  });

  it('TEST-PHASE8-STRIPE-08: remboursement ⇒ reverse de la commission créateur', async () => {
    const fake = installFake();
    stripeMock.constructEvent.mockReturnValue(
      event('charge.refunded', { id: 'ch_1', payment_intent: 'pi_phase8' })
    );

    const response = await POST(request('{"id":"evt_phase8_refund"}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, kind: 'refund' });
    expect(stripeMock.list).toHaveBeenCalledWith({
      payment_intent: 'pi_phase8',
      limit: 1,
    });
    expect(fake.calls.rpcs.map((r) => r.fn)).toContain('reverse_kit_attribution_by_session');
  });

  it('TEST-PHASE8-STRIPE-09: annulation d’abonnement ⇒ acquittée sans écriture d’entitlement', async () => {
    const fake = installFake();
    stripeMock.constructEvent.mockReturnValue(
      event('customer.subscription.deleted', { id: 'sub_phase8' })
    );

    const response = await POST(request('{"id":"evt_phase8_cancel"}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      received: true,
      kind: 'subscription_canceled',
    });
    expect(grantMock).not.toHaveBeenCalled();
    expect(fake.calls.inserts.some((i) => i.table === 'orders')).toBe(false);
  });

  it('TEST-PHASE8-STRIPE-10: échec de traitement ⇒ réservation libérée et 500 (retry Stripe)', async () => {
    const fake = installFake();
    stripeMock.constructEvent.mockReturnValue(event('checkout.session.completed', CHECKOUT_SESSION));
    stripeMock.retrieve.mockRejectedValue(new Error('Stripe réseau indisponible'));

    const response = await POST(request('{"id":"evt_phase8_boom"}'));

    expect(response.status).toBe(500);
    expect(fake.calls.deletes.some((d) => d.table === 'stripe_events')).toBe(true);
    expect(fake.calls.updates.some((u) => u.table === 'stripe_events')).toBe(false);
  });
});
