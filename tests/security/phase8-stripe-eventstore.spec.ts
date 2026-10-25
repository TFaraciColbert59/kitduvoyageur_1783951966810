/**
 * Phase 8 — Idempotence `stripe_events` (réservation/libération).
 *
 *   TEST-PHASE8-STRIPE-IDEM-01 première livraison réservée
 *   TEST-PHASE8-STRIPE-IDEM-02 doublon 23505 acquitté sans exception
 *   TEST-PHASE8-STRIPE-IDEM-03 erreur d'infrastructure propagée (retry)
 *   TEST-PHASE8-STRIPE-IDEM-04 marquage traité
 *   TEST-PHASE8-STRIPE-IDEM-05 libération best-effort (jamais d'exception)
 */
import { describe, it, expect, vi } from 'vitest';
import {
  beginStripeEvent,
  markStripeEventProcessed,
  releaseStripeEvent,
  STRIPE_EVENTS_TABLE,
} from '@/lib/stripe/eventStore';
import { createFakeSupabase } from '../mocks/fakeSupabaseStripe';

const EVENT = {
  id: 'evt_idem_1',
  type: 'checkout.session.completed',
  livemode: false,
  data: { object: { id: 'cs_idem' } },
};

describe('Phase 8 — idempotence des événements Stripe', () => {
  it('TEST-PHASE8-STRIPE-IDEM-01: première livraison réservée (status processing)', async () => {
    const fake = createFakeSupabase();

    const result = await beginStripeEvent(fake.client, EVENT);

    expect(result).toEqual({ firstDelivery: true, eventId: 'evt_idem_1' });
    const row = fake.calls.inserts.find((i) => i.table === STRIPE_EVENTS_TABLE)?.row;
    expect(row).toMatchObject({
      event_id: 'evt_idem_1',
      type: 'checkout.session.completed',
      kind: 'checkout_completed',
      status: 'processing',
    });
  });

  it('TEST-PHASE8-STRIPE-IDEM-02: doublon 23505 ⇒ firstDelivery false, aucune exception', async () => {
    const fake = createFakeSupabase({ duplicateEvent: true });

    await expect(beginStripeEvent(fake.client, EVENT)).resolves.toEqual({
      firstDelivery: false,
      eventId: 'evt_idem_1',
    });
  });

  it('TEST-PHASE8-STRIPE-IDEM-03: erreur d’infrastructure ⇒ propagée (le webhook répondra 500)', async () => {
    const fake = createFakeSupabase({ eventInsertInfraError: true });

    await expect(beginStripeEvent(fake.client, EVENT)).rejects.toThrow(/réservation impossible/);
  });

  it('TEST-PHASE8-STRIPE-IDEM-04: marquage traité avec horodatage', async () => {
    const fake = createFakeSupabase();

    await markStripeEventProcessed(fake.client, 'evt_idem_1');

    const update = fake.calls.updates.find((u) => u.table === STRIPE_EVENTS_TABLE)?.row;
    expect(update?.status).toBe('processed');
    expect(typeof update?.processed_at).toBe('string');
  });

  it('TEST-PHASE8-STRIPE-IDEM-05: libération best-effort, jamais d’exception', async () => {
    const fake = createFakeSupabase();
    await releaseStripeEvent(fake.client, 'evt_idem_1');
    expect(fake.calls.deletes.some((d) => d.table === STRIPE_EVENTS_TABLE)).toBe(true);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = {
      from: () => ({
        delete: () => ({
          eq: async () => {
            throw new Error('réseau coupé');
          },
        }),
      }),
    } as never;
    await expect(releaseStripeEvent(throwing, 'evt_idem_2')).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
