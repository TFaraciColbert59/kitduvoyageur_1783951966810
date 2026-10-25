import { describe, expect, it, vi } from 'vitest';
import { startCheckout } from '../server/checkoutService';
import { BOOKING_PROVIDER_ERROR_CODES, BookingProviderError } from '../server/bookingProviderErrors';
import type {
  BookingCandidate,
  CheckoutContext,
  CheckoutResult,
} from '../server/bookingProviderTypes';
import type { BookingStore } from '../server/bookingPersistence';

/**
 * Meme contrainte SQL que le flow panier :
 * `amount_eur numeric(12,2) NOT NULL DEFAULT 0`,
 * `currency text NOT NULL DEFAULT 'EUR'` + `CHECK (currency ~ '^[A-Z]{3}$')`.
 * Le schema ne sait pas porter « inconnu » : on refuse d ecrire plutot que
 * d ecrire 0 EUR, qui serait indiscernable d un vrai gratuit.
 */

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const BOOKING_ID = '44444444-4444-4444-8444-444444444444';

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

function storeQuiAccepte(): BookingStore {
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: BOOKING_ID,
              trip_id: TRIP_ID,
              vertical: 'hotel',
              provider: 'routestack',
              external_ref: 'ref-1',
              amount_eur: 240,
              currency: 'EUR',
              status: 'pending',
              checkout_mode: 'deeplink',
              metadata: {},
              created_at: '2026-09-27T00:00:00.000Z',
              updated_at: '2026-09-27T00:00:00.000Z',
            },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as BookingStore;
}

const checkoutUrl = vi.fn(
  async (_candidate: BookingCandidate, _context: CheckoutContext): Promise<CheckoutResult> => ({
    mode: 'deeplink',
    url: 'https://example.com/pay',
    bookingId: null,
  })
);

const cart = { userId: USER_ID, tripId: TRIP_ID } as never;

function baseInput(overrides: Partial<BookingCandidate> = {}) {
  return {
    store: storeQuiAccepte(),
    cart,
    userId: USER_ID,
    tripId: TRIP_ID,
    candidate: candidat(overrides),
    checkoutUrl,
  };
}

describe('startCheckout — refus d ecrire un prix invente', () => {
  it('insere un montant reellement connu', async () => {
    const input = baseInput({ amount: 240.5 });
    const addCartLine = vi.fn().mockResolvedValue(undefined);

    await startCheckout(input, { addCartLine });

    const insert = (input.store.from as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(insert).toBeDefined();
    expect(input.store.from).toHaveBeenCalledWith('bookings');
  });

  it('NE PERSISTE PAS amount_eur = 0 quand le prix est null', async () => {
    const store = storeQuiAccepte();
    const addCartLine = vi.fn().mockResolvedValue(undefined);

    await expect(
      startCheckout({ ...baseInput({ amount: null }), store }, { addCartLine })
    ).rejects.toBeInstanceOf(BookingProviderError);

    expect(store.from).not.toHaveBeenCalled();
    expect(addCartLine).not.toHaveBeenCalled();
  });

  it('NE PERSISTE PAS amount_eur = 0 quand le prix vaut 0', async () => {
    const store = storeQuiAccepte();

    await expect(
      startCheckout({ ...baseInput({ amount: 0 }), store }, { addCartLine: vi.fn() })
    ).rejects.toBeInstanceOf(BookingProviderError);

    expect(store.from).not.toHaveBeenCalled();
  });

  it('NE PERSISTE PAS amount_eur = 0 quand le prix est negatif ou NaN', async () => {
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const store = storeQuiAccepte();
      await expect(
        startCheckout({ ...baseInput({ amount }), store }, { addCartLine: vi.fn() })
      ).rejects.toBeInstanceOf(BookingProviderError);
      expect(store.from).not.toHaveBeenCalled();
    }
  });

  it('classe le refus en erreur de validation non rejouable', async () => {
    try {
      await startCheckout(baseInput({ amount: null }), { addCartLine: vi.fn() });
      throw new Error('aurait du lever');
    } catch (error) {
      expect(error).toBeInstanceOf(BookingProviderError);
      const typed = error as BookingProviderError;
      expect(typed.code).toBe(BOOKING_PROVIDER_ERROR_CODES.validation);
      expect(typed.retryable).toBe(false);
      expect(typed.message).toMatch(/prix/i);
    }
  });

  it('n emet jamais la cause interne dans le message public', async () => {
    try {
      await startCheckout(baseInput({ amount: null }), { addCartLine: vi.fn() });
      throw new Error('aurait du lever');
    } catch (error) {
      const typed = error as BookingProviderError;
      expect(typed.message).not.toMatch(/postgres|supabase|sql|column/i);
      expect(Object.keys(typed.toJSON())).not.toContain('cause');
    }
  });
});

describe('startCheckout — refus d ecrire une devise inventee', () => {
  it('NE PERSISTE PAS currency = EUR quand la devise est null', async () => {
    const store = storeQuiAccepte();

    await expect(
      startCheckout({ ...baseInput({ currency: null }), store }, { addCartLine: vi.fn() })
    ).rejects.toBeInstanceOf(BookingProviderError);

    expect(store.from).not.toHaveBeenCalled();
  });

  it('NE PERSISTE PAS currency = EUR quand la devise est en minuscules', async () => {
    const store = storeQuiAccepte();

    await expect(
      startCheckout({ ...baseInput({ currency: 'jpy' }), store }, { addCartLine: vi.fn() })
    ).rejects.toBeInstanceOf(BookingProviderError);

    expect(store.from).not.toHaveBeenCalled();
  });

  it('refuse la devise invalide avec un message qui cite la devise', async () => {
    try {
      await startCheckout(baseInput({ currency: null }), { addCartLine: vi.fn() });
      throw new Error('aurait du lever');
    } catch (error) {
      expect((error as BookingProviderError).message).toMatch(/devise/i);
      expect((error as BookingProviderError).code).toBe(BOOKING_PROVIDER_ERROR_CODES.validation);
    }
  });

  it('conserve une devise etrangere reellement confirmee', async () => {
    const store = storeQuiAccepte();
    await startCheckout({ ...baseInput({ currency: 'JPY' }), store }, { addCartLine: vi.fn() });
    expect(store.from).toHaveBeenCalledWith('bookings');
  });
});

describe('startCheckout — le refus du prix prime sur celui de la devise', () => {
  it('signale le prix en premier quand les deux sont inconnus', async () => {
    try {
      await startCheckout(baseInput({ amount: null, currency: null }), { addCartLine: vi.fn() });
      throw new Error('aurait du lever');
    } catch (error) {
      expect((error as BookingProviderError).message).toMatch(/prix/i);
    }
  });
});

describe('startCheckout — aucune regression sur le chemin nominal', () => {
  it('renvoie l identifiant de reservation cree', async () => {
    const result = await startCheckout(baseInput(), { addCartLine: vi.fn() });

    expect(result.bookingId).toBe(BOOKING_ID);
    expect(result.mode).toBe('deeplink');
  });

  it('ajoute exactement une ligne de panier de kind booking', async () => {
    const addCartLine = vi.fn().mockResolvedValue(undefined);

    await startCheckout(baseInput(), { addCartLine });

    expect(addCartLine).toHaveBeenCalledTimes(1);
    expect(addCartLine.mock.calls[0]?.[1]).toMatchObject({
      kind: 'booking',
      refId: BOOKING_ID,
      quantity: 1,
    });
  });

  it('ne demande jamais la conversion de devises : on refuse plutot que convertir', async () => {
    const store = storeQuiAccepte();
    await expect(
      startCheckout({ ...baseInput({ currency: null, amount: 500 }), store }, { addCartLine: vi.fn() })
    ).rejects.toBeInstanceOf(BookingProviderError);
  });
});
