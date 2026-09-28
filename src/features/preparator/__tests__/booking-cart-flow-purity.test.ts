import { describe, expect, it, vi } from 'vitest';
import {
  BookingCartFlowError,
  addOfferToTripCart,
  buildBookingCreatePayload,
  buildCartMetadata,
} from '../engine/bookingCartFlow';
import type { BookingCandidate } from '@/features/booking/server/bookingProviderTypes';

/**
 * `bookings.amount_eur` est `numeric(12,2) NOT NULL DEFAULT 0` et
 * `bookings.currency` est `text NOT NULL` avec `CHECK (currency ~ '^[A-Z]{3}$')`.
 * Le schema ne peut donc pas porter la valeur « inconnu » : ecrire 0 EUR pour
 * un prix non connu est un mensonge persisted, pas une donnee absente.
 * Le seul comportement honnete est donc de REFUSER l'ecriture.
 */

const TRIP_ID = '11111111-1111-4111-8111-111111111111';

function candidat(overrides: Partial<BookingCandidate> = {}): BookingCandidate {
  return {
    id: 'cand-1',
    provider: 'routestack',
    vertical: 'hotel',
    title: 'Hotel de test',
    description: null,
    amount: 240,
    currency: 'EUR',
    deeplink: 'https://example.com/offre',
    bookingKind: 'search',
    requiresRevalidation: false,
    providerReference: 'ref-1',
    metadata: {},
    ...overrides,
  };
}

function transportQuiRepond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('buildBookingCreatePayload — refus d un prix invente', () => {
  it('conserve un prix reellement connu', () => {
    const payload = buildBookingCreatePayload(TRIP_ID, candidat({ amount: 240.5 }));

    expect(payload.amount_eur).toBe(240.5);
  });

  it('NE TRANSFORME PAS un prix null en 0', () => {
    expect(() => buildBookingCreatePayload(TRIP_ID, candidat({ amount: null }))).toThrow(
      BookingCartFlowError
    );
  });

  it('NE TRANSFORME PAS un prix absent (undefined) en 0', () => {
    expect(() =>
      buildBookingCreatePayload(TRIP_ID, candidat({ amount: undefined as unknown as number }))
    ).toThrow(BookingCartFlowError);
  });

  it('NE TRANSFORME PAS un prix nul en 0', () => {
    expect(() => buildBookingCreatePayload(TRIP_ID, candidat({ amount: 0 }))).toThrow(
      /prix/i
    );
  });

  it('NE TRANSFORME PAS un prix negatif en 0', () => {
    expect(() => buildBookingCreatePayload(TRIP_ID, candidat({ amount: -20 }))).toThrow(
      /prix/i
    );
  });

  it('NE TRANSFORME PAS un prix NaN en 0', () => {
    expect(() => buildBookingCreatePayload(TRIP_ID, candidat({ amount: Number.NaN }))).toThrow(
      /prix/i
    );
  });

  it('NE TRANSFORME PAS un prix infini en 0', () => {
    expect(() =>
      buildBookingCreatePayload(TRIP_ID, candidat({ amount: Number.POSITIVE_INFINITY }))
    ).toThrow(/prix/i);
  });

  it('signale un prix inconnu avec un code dedie, pas un code de creation', () => {
    try {
      buildBookingCreatePayload(TRIP_ID, candidat({ amount: null }));
      throw new Error('aurait du lever');
    } catch (error) {
      expect(error).toBeInstanceOf(BookingCartFlowError);
      expect((error as BookingCartFlowError).code).toBe('booking_amount_unknown');
    }
  });
});

describe('buildBookingCreatePayload — refus d une devise inventee', () => {
  it('conserve une devise reellement confirmee', () => {
    expect(buildBookingCreatePayload(TRIP_ID, candidat({ currency: 'JPY' })).currency).toBe('JPY');
  });

  it('NE FORCE PAS EUR quand la devise est null', () => {
    try {
      buildBookingCreatePayload(TRIP_ID, candidat({ currency: null }));
      throw new Error('aurait du lever');
    } catch (error) {
      expect(error).toBeInstanceOf(BookingCartFlowError);
      expect((error as BookingCartFlowError).code).toBe('booking_currency_unknown');
    }
  });

  it('NE FORCE PAS EUR quand la devise est en minuscules', () => {
    expect(() => buildBookingCreatePayload(TRIP_ID, candidat({ currency: 'jpy' }))).toThrow(
      BookingCartFlowError
    );
  });

  it('NE FORCE PAS EUR quand la devise nest pas un code ISO a 3 lettres', () => {
    expect(() => buildBookingCreatePayload(TRIP_ID, candidat({ currency: 'EURO' }))).toThrow(
      BookingCartFlowError
    );
  });

  it('ne verifie jamais la devise avant le prix : les deux sont refuses', () => {
    try {
      buildBookingCreatePayload(TRIP_ID, candidat({ amount: null, currency: null }));
      throw new Error('aurait du lever');
    } catch (error) {
      expect((error as BookingCartFlowError).code).toBe('booking_amount_unknown');
    }
  });
});

describe('buildBookingCreatePayload — aucune string vide fabriquee', () => {
  it('NE FABRIQUE PAS une reference fournisseur vide dans les metadonnees', () => {
    const payload = buildBookingCreatePayload(TRIP_ID, candidat({ providerReference: null }));

    expect(payload.metadata.providerReference).toBeNull();
  });

  it('NE FABRIQUE PAS une description vide dans les metadonnees', () => {
    const payload = buildBookingCreatePayload(TRIP_ID, candidat({ description: null }));

    expect(payload.metadata.description).toBeNull();
  });

  it('omet le deeplink plutot que de strire une URL invalide', () => {
    const payload = buildBookingCreatePayload(
      TRIP_ID,
      candidat({ deeplink: 'javascript:alert(1)' })
    );

    expect('deeplink' in payload.metadata).toBe(false);
  });
});

describe('buildCartMetadata — aucune string vide fabriquee', () => {
  it('NE FABRIQUE PAS un deeplink vide quand le fournisseur nen fournit pas', () => {
    expect('deeplink' in buildCartMetadata(candidat({ deeplink: null }))).toBe(false);
  });
});

describe('addOfferToTripCart — aucun appel reseau quand le prix est inconnu', () => {
  it('refuse sans contacter le serveur quand le prix est null', async () => {
    const transport = transportQuiRepond(201, { data: { id: 'x' } });

    await expect(
      addOfferToTripCart({ tripId: TRIP_ID, offer: candidat({ amount: null }), transport })
    ).rejects.toMatchObject({ code: 'booking_amount_unknown' });

    expect(transport).not.toHaveBeenCalled();
  });

  it('refuse sans contacter le serveur quand la devise est inconnue', async () => {
    const transport = transportQuiRepond(201, { data: { id: 'x' } });

    await expect(
      addOfferToTripCart({ tripId: TRIP_ID, offer: candidat({ currency: null }), transport })
    ).rejects.toMatchObject({ code: 'booking_currency_unknown' });

    expect(transport).not.toHaveBeenCalled();
  });

  it('lavoie un montant strictement positif quand tout est connu', async () => {
    const bookingId = '22222222-2222-4222-8222-222222222222';
    const transport = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: { id: bookingId } }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ success: true, created: true }) });

    await addOfferToTripCart({ tripId: TRIP_ID, offer: candidat({ amount: 89.9 }), transport });

    const body = JSON.parse(String(transport.mock.calls[0]?.[1]?.body));
    expect(body.amount_eur).toBe(89.9);
    expect(body.amount_eur).toBeGreaterThan(0);
    expect(body.currency).toBe('EUR');
  });
});
