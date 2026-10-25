/**
 * Phase 8 — Classification Stripe, extraction de grant et configuration prix.
 *
 *   TEST-PHASE8-STRIPE-CLASS-* : mapping type → catégorie, résumé sans PII
 *   TEST-PHASE8-STRIPE-GRANT-* : extraction metadata (jamais un prix inventé)
 *   TEST-PHASE8-STRIPE-PRICE-* : fail-safe des 6 price IDs pilotés par env
 */
import { describe, it, expect } from 'vitest';
import {
  classifyStripeEvent,
  extractEntitlementGrant,
  summarizeStripeEvent,
  STRIPE_EVENT_KIND_BY_TYPE,
  type StripeEventLike,
} from '@/lib/stripe/events';
import {
  STRIPE_PRICE_ENV_KEYS,
  stripeBillingConfiguration,
} from '@/lib/entitlements/server';

function event(type: string, object: Record<string, unknown> = { id: 'obj_1' }): StripeEventLike {
  return { id: 'evt_1', type, livemode: true, data: { object } };
}

describe('Phase 8 — classification des événements Stripe', () => {
  it('TEST-PHASE8-STRIPE-CLASS-01: les 5 catégories métier sont mappées explicitement', () => {
    expect(classifyStripeEvent(event('checkout.session.completed'))).toBe('checkout_completed');
    expect(classifyStripeEvent(event('invoice.paid'))).toBe('subscription_renewed');
    expect(classifyStripeEvent(event('invoice.payment_succeeded'))).toBe('subscription_renewed');
    expect(classifyStripeEvent(event('invoice.payment_failed'))).toBe('payment_failed');
    expect(classifyStripeEvent(event('charge.refunded'))).toBe('refund');
    expect(classifyStripeEvent(event('customer.subscription.deleted'))).toBe('subscription_canceled');
  });

  it('TEST-PHASE8-STRIPE-CLASS-02: type inconnu ou malformé ⇒ ignored (jamais une erreur)', () => {
    expect(classifyStripeEvent(event('payment_intent.created'))).toBe('ignored');
    expect(classifyStripeEvent({ id: 'evt_x', type: '' })).toBe('ignored');
    expect(classifyStripeEvent(undefined as unknown as StripeEventLike)).toBe('ignored');
    expect(Object.keys(STRIPE_EVENT_KIND_BY_TYPE)).not.toContain('ignored');
  });

  it('TEST-PHASE8-STRIPE-CLASS-03: résumé sans PII (id, type, kind, livemode, objet)', () => {
    const summary = summarizeStripeEvent({
      id: 'evt_sum',
      type: 'charge.refunded',
      livemode: true,
      data: { object: { id: 'ch_42', receipt_email: 'secret@example.invalid' } },
    });
    expect(summary).toEqual({
      eventId: 'evt_sum',
      type: 'charge.refunded',
      kind: 'refund',
      livemode: true,
      objectId: 'ch_42',
    });
    expect(JSON.stringify(summary)).not.toContain('secret@example.invalid');
  });

  it('TEST-PHASE8-STRIPE-CLASS-04: objet absent ou sans id ⇒ objectId null', () => {
    expect(summarizeStripeEvent({ id: 'evt_a', type: 'invoice.paid' }).objectId).toBeNull();
    expect(
      summarizeStripeEvent({ id: 'evt_b', type: 'invoice.paid', data: { object: {} } }).objectId
    ).toBeNull();
  });
});

describe('Phase 8 — extraction du grant d’entitlement (serveur uniquement)', () => {
  it('TEST-PHASE8-STRIPE-GRANT-01: metadata directe de session', () => {
    const grant = extractEntitlementGrant(
      event('checkout.session.completed', {
        id: 'cs_1',
        metadata: { user_id: 'user-1', plan: 'explorer', pass: 'weekend' },
      })
    );
    expect(grant).toEqual({
      userId: 'user-1',
      metadata: { user_id: 'user-1', plan: 'explorer', pass: 'weekend' },
      source: 'checkout_session',
    });
  });

  it('TEST-PHASE8-STRIPE-GRANT-02: metadata d’abonnement de facture', () => {
    const grant = extractEntitlementGrant(
      event('invoice.paid', {
        id: 'in_1',
        subscription_details: { metadata: { user_id: 'user-2', plan: 'expedition' } },
      })
    );
    expect(grant?.source).toBe('invoice_subscription');
    expect(grant?.userId).toBe('user-2');
  });

  it('TEST-PHASE8-STRIPE-GRANT-03: metadata de ligne de facture en dernier recours', () => {
    const grant = extractEntitlementGrant(
      event('invoice.paid', {
        id: 'in_2',
        lines: { data: [{ metadata: { user_id: 'user-3', pass: 'trip' } }] },
      })
    );
    expect(grant?.source).toBe('invoice_line');
    expect(grant?.userId).toBe('user-3');
  });

  it('TEST-PHASE8-STRIPE-GRANT-04: sans user_id (ou anonyme) ⇒ null, aucune écriture possible', () => {
    expect(extractEntitlementGrant(event('invoice.paid', { id: 'in_3' }))).toBeNull();
    expect(
      extractEntitlementGrant(event('invoice.paid', { id: 'in_4', metadata: { user_id: 'anonymous' } }))
    ).toBeNull();
    expect(
      extractEntitlementGrant(event('invoice.paid', { id: 'in_5', metadata: { user_id: 42 } }))
    ).toBeNull();
  });
});

describe('Phase 8 — price IDs Stripe pilotés par l’environnement (fail-safe)', () => {
  it('TEST-PHASE8-STRIPE-PRICE-01: la liste exacte attendue est déclarée (6 clés)', () => {
    expect(STRIPE_PRICE_ENV_KEYS).toEqual({
      explorer: 'STRIPE_PRICE_EXPLORER',
      expedition: 'STRIPE_PRICE_EXPEDITION',
      group: 'STRIPE_PRICE_GROUP',
      pass_weekend: 'STRIPE_PRICE_PASS_WEEKEND',
      pass_trip: 'STRIPE_PRICE_PASS_TRIP',
      pass_expedition: 'STRIPE_PRICE_PASS_EXPEDITION',
    });
  });

  it('TEST-PHASE8-STRIPE-PRICE-02: aucun env ⇒ configured:false, aucun prix inventé', () => {
    const config = stripeBillingConfiguration({});
    expect(config.secretKey).toBe(false);
    expect(config.configured).toBe(false);
    expect(Object.values(config.priceIds).every((present) => present === false)).toBe(true);
  });

  it('TEST-PHASE8-STRIPE-PRICE-03: clé placeholder `your-` ⇒ non configurée', () => {
    const config = stripeBillingConfiguration({ STRIPE_SECRET_KEY: 'sk_test_your-key-here' });
    expect(config.secretKey).toBe(false);
    expect(config.configured).toBe(false);
  });

  it('TEST-PHASE8-STRIPE-PRICE-04: clé + au moins un price id ⇒ configured:true', () => {
    const config = stripeBillingConfiguration({
      STRIPE_SECRET_KEY: 'sk_test_phase8_fake',
      STRIPE_PRICE_EXPLORER: 'price_explorer_test',
    });
    expect(config.secretKey).toBe(true);
    expect(config.configured).toBe(true);
    expect(config.priceIds.explorer).toBe(true);
    expect(config.priceIds.expedition).toBe(false);
  });

  it('TEST-PHASE8-STRIPE-PRICE-05: clé sans aucun price id ⇒ configured:false (fail-safe)', () => {
    const config = stripeBillingConfiguration({ STRIPE_SECRET_KEY: 'sk_test_phase8_fake' });
    expect(config.secretKey).toBe(true);
    expect(config.configured).toBe(false);
  });
});
