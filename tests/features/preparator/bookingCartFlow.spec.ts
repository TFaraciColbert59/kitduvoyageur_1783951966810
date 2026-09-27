import { describe, expect, it, vi } from 'vitest';
import {
  addOfferToTripCart,
  buildBookingCreatePayload,
  buildCartMetadata,
  type BookingCartTransport,
} from '@/features/preparator/engine/bookingCartFlow';
import type { BookingCandidate } from '@/features/booking/server/bookingProviderTypes';

const TRIP = '33333333-3333-4333-8333-333333333333';
const BOOKING = '22222222-2222-4222-8222-222222222222';

const offer: BookingCandidate = {
  id: 'offer-flight-1',
  provider: 'routestack',
  vertical: 'flight',
  title: 'Vol Paris → Lyon',
  description: 'Aller-retour, 1 bagage inclus',
  amount: 812.5,
  currency: 'EUR',
  deeplink: 'https://partners.example/offer/1',
  bookingKind: 'deeplink',
  requiresRevalidation: true,
  providerReference: 'rs-opaque-1',
  metadata: { apiKey: 'do-not-forward' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('buildBookingCreatePayload', () => {
  it('construit une réservation pending déterministe et sans prix arbitraire', () => {
    const payload = buildBookingCreatePayload(TRIP, offer);

    expect(payload).toMatchObject({
      vertical: 'flight',
      provider: 'routestack',
      amount_eur: 812.5,
      currency: 'EUR',
      status: 'pending',
      checkout_mode: 'deeplink',
    });
    expect(payload.external_ref).toContain(TRIP);
    expect(payload.external_ref).toContain('rs-opaque-1');
    expect(payload.metadata).not.toHaveProperty('apiKey');
  });

  it('accepte un prix absent sans inventer de montant', () => {
    expect(buildBookingCreatePayload(TRIP, { ...offer, amount: null }).amount_eur).toBe(0);
  });
});

describe('buildCartMetadata', () => {
  it('conserve uniquement les métadonnées d’affichage autorisées', () => {
    expect(buildCartMetadata(offer)).toEqual({
      title: 'Vol Paris → Lyon',
      vertical: 'flight',
      provider: 'routestack',
      status: 'pending',
      deeplink: 'https://partners.example/offer/1',
      requiresRevalidation: true,
    });
  });

  it('retire une URL non http(s)', () => {
    expect(buildCartMetadata({ ...offer, deeplink: 'javascript:alert(1)' })).not.toHaveProperty('deeplink');
  });
});

describe('addOfferToTripCart', () => {
  it('crée la réservation puis ajoute la ligne au panier sans prix local', async () => {
    const transport = vi.fn<BookingCartTransport>()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: BOOKING } }, 201))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'line-1' }, created: true }, 201));

    const result = await addOfferToTripCart({ tripId: TRIP, offer, transport });

    expect(result).toEqual({ bookingId: BOOKING, created: true, deduplicated: false });
    expect(transport).toHaveBeenCalledTimes(2);

    const [bookingUrl, bookingInit] = transport.mock.calls[0]!;
    expect(bookingUrl).toBe(`/api/trips/${TRIP}/bookings`);
    expect(bookingInit.method).toBe('POST');
    expect(JSON.parse(bookingInit.body!)).toMatchObject({ status: 'pending', amount_eur: 812.5 });

    const [cartUrl, cartInit] = transport.mock.calls[1]!;
    expect(cartUrl).toBe(`/api/trips/${TRIP}/cart-lines`);
    expect(cartInit.method).toBe('POST');
    const cartBody = JSON.parse(cartInit.body!);
    expect(cartBody).toMatchObject({
      kind: 'booking',
      refId: BOOKING,
      quantity: 1,
      metadata: { title: 'Vol Paris → Lyon', status: 'pending' },
    });
    expect(cartInit.body!).not.toContain('amount_eur');
    expect(cartInit.body!).not.toContain('812.5');
    expect(cartInit.body!).not.toContain('unit_price_eur');
  });

  it('réutilise une réservation existante après un conflit 409', async () => {
    const externalRef = buildBookingCreatePayload(TRIP, offer).external_ref;
    const transport = vi.fn<BookingCartTransport>()
      .mockResolvedValueOnce(jsonResponse({ error: 'booking_create_failed' }, 409))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [{ id: BOOKING, external_ref: externalRef }] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'line-1' }, created: false, deduplicated: true }, 200));

    const result = await addOfferToTripCart({ tripId: TRIP, offer, transport });

    expect(result).toEqual({ bookingId: BOOKING, created: false, deduplicated: true });
    expect(transport).toHaveBeenCalledTimes(3);
    expect(transport.mock.calls[1][0]).toBe(`/api/trips/${TRIP}/bookings`);
    expect(transport.mock.calls[1][1]).toMatchObject({ method: 'GET' });
  });

  it('ne touche pas au panier si la création de réservation échoue', async () => {
    const transport = vi.fn<BookingCartTransport>().mockResolvedValueOnce(
      jsonResponse({ error: 'booking_create_failed' }, 500)
    );

    await expect(addOfferToTripCart({ tripId: TRIP, offer, transport })).rejects.toMatchObject({
      code: 'booking_create_failed',
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('refuse une réponse de réservation sans identifiant exploitable', async () => {
    const transport = vi.fn<BookingCartTransport>().mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'pas-un-uuid' } }, 201)
    );

    await expect(addOfferToTripCart({ tripId: TRIP, offer, transport })).rejects.toMatchObject({
      code: 'booking_create_invalid',
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('remonte un échec du panier après avoir cré la réservation', async () => {
    const transport = vi.fn<BookingCartTransport>()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: BOOKING } }, 201))
      .mockResolvedValueOnce(jsonResponse({ error: 'cart_write_failed' }, 500));

    await expect(addOfferToTripCart({ tripId: TRIP, offer, transport })).rejects.toMatchObject({
      code: 'cart_add_failed',
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });
});





