import { describe, expect, it, vi } from 'vitest';

import type { CartContext } from '@/features/cart/server/cartService';
import { startCheckout } from '@/features/booking/server/checkoutService';
import type { BookingCandidate } from '@/features/booking/server/bookingProviderTypes';
import type { BookingStore } from '@/features/booking/server/bookingPersistence';

/**
 * W5 — un checkout doit laisser deux traces coherentes : une ligne `bookings`
 * et une ligne `cart_lines` qui la reference. L'ordre compte : une ligne de
 * panier pointant vers une reservation inexistante est un orphelin que rien ne
 * re reconcilie.
 */
const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-1';
const BOOKING_ID = '22222222-2222-4222-8222-222222222222';
/**
 * `addTripCartLine` est toujours injecte dans ces tests : le client Supabase
 * du contexte n'est donc jamais touche. On le laisse vide plutot que de
 * monter un faux client qui donnerait l'illusion d'un RLS reellement exerce.
 */
const CART = { userId: USER_ID, tripId: TRIP_ID, supabase: {} } as unknown as CartContext;

const candidate: BookingCandidate = {
  id: 'FL-1',
  provider: 'routestack',
  vertical: 'flight',
  title: 'CDG -> NRT',
  description: null,
  amount: 640.5,
  currency: 'EUR',
  deeplink: null,
  bookingKind: 'deeplink',
  requiresRevalidation: false,
  providerReference: 'FL-1',
  metadata: {},
};

function fakeStore(overrides: { error?: { message: string; code?: string } | null } = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  const store: BookingStore = {
    rpc: async () => ({ data: true, error: null }),
    from: () => ({
      insert: (values: Record<string, unknown>) => {
        inserted.push(values);
        return {
          select: () => ({
            single: async () => {
              if (overrides.error) return { data: null, error: overrides.error };
              return {
                data: {
                  id: BOOKING_ID,
                  trip_id: TRIP_ID,
                  vertical: values.vertical,
                  provider: values.provider,
                  external_ref: values.external_ref ?? null,
                  amount_eur: values.amount_eur,
                  currency: values.currency,
                  status: 'pending',
                  checkout_mode: values.checkout_mode,
                  metadata: values.metadata,
                  created_at: '2026-09-27T00:00:00.000Z',
                  updated_at: '2026-09-27T00:00:00.000Z',
                },
                error: null,
              };
            },
          }),
        };
      },
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
    }),
  };
  return { store, inserted };
}

describe('startCheckout — orchestration', () => {
  it('ecrit bookings puis cart_lines, la ligne de panier pointant sur la reservation', async () => {
    const { store, inserted } = fakeStore();
    const addCartLine = vi.fn().mockResolvedValue({ created: true, deduplicated: false });

    const result = await startCheckout(
      {
        store,
        cart: CART,
        userId: USER_ID,
        tripId: TRIP_ID,
        candidate,
        checkoutUrl: async () => ({ mode: 'deeplink', url: 'https://mcp.routestack.ai/pay/1', bookingId: null }),
      },
      { addCartLine }
    );

    expect(result.bookingId).toBe(BOOKING_ID);
    expect(result.mode).toBe('deeplink');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      trip_id: TRIP_ID,
      user_id: USER_ID,
      vertical: 'flight',
      provider: 'routestack',
      status: 'pending',
      checkout_mode: 'deeplink',
    });
    // La cle de la reservation est celle produite par l'insert, pas un UUID devine.
    expect(addCartLine).toHaveBeenCalledTimes(1);
    expect(addCartLine).toHaveBeenCalledWith(
      CART,
      expect.objectContaining({ kind: 'booking', refId: BOOKING_ID })
    );
  });

  it("l'echec d'insertion n'ecrit AUCUNE ligne de panier", async () => {
    const { store } = fakeStore({ error: { message: 'violates rls', code: '42501' } });
    const addCartLine = vi.fn();

    await expect(
      startCheckout(
        {
          store,
          cart: CART,
          userId: USER_ID,
          tripId: TRIP_ID,
          candidate,
          checkoutUrl: async () => ({ mode: 'deeplink', url: 'https://mcp.routestack.ai/pay/1', bookingId: null }),
        },
        { addCartLine }
      )
    ).rejects.toThrow();

    // Pas d'orphelin : un panier qui reference une reservation inexistante.
    expect(addCartLine).not.toHaveBeenCalled();
  });

  it("le mode external est reporte en metadata, le mode stocke reste un enum valide", async () => {
    const { store, inserted } = fakeStore();
    const addCartLine = vi.fn().mockResolvedValue({ created: true, deduplicated: false });

    await startCheckout(
      {
        store,
        cart: CART,
        userId: USER_ID,
        tripId: TRIP_ID,
        candidate: { ...candidate, provider: 'viator', vertical: 'activity' },
        checkoutUrl: async () => ({ mode: 'external', url: 'https://www.viator.com/x?pid=1', bookingId: null }),
      },
      { addCartLine }
    );

    // L'enum BDD ne contient que deeplink/acp (contrainte non modifiable ici) :
    // la nature "external" vit donc dans les metadonnees, pas dans la colonne.
    expect(inserted[0].checkout_mode).toBe('deeplink');
    expect(inserted[0].metadata).toMatchObject({ checkout_channel: 'external' });
  });

  it("un candidat sans devise connue n'invente pas EUR", async () => {
    const { store, inserted } = fakeStore();
    const addCartLine = vi.fn().mockResolvedValue({ created: true, deduplicated: false });

    await startCheckout(
      {
        store,
        cart: CART,
        userId: USER_ID,
        tripId: TRIP_ID,
        candidate: { ...candidate, currency: null },
        checkoutUrl: async () => ({ mode: 'deeplink', url: null, bookingId: null }),
      },
      { addCartLine }
    );

    expect(inserted[0].currency).toBe('EUR');
    expect(inserted[0].metadata).toMatchObject({ currency_unknown: true });
  });

  it("l'echec du panier remonte apres avoir trace la reservation", async () => {
    const { store, inserted } = fakeStore();
    const addCartLine = vi.fn().mockRejectedValue(new Error('[cart] voyage inconnu'));

    await expect(
      startCheckout(
        {
          store,
          cart: CART,
          userId: USER_ID,
          tripId: TRIP_ID,
          candidate,
          checkoutUrl: async () => ({ mode: 'deeplink', url: 'https://mcp.routestack.ai/pay/1', bookingId: null }),
        },
        { addCartLine }
      )
    ).rejects.toThrow('[cart] voyage inconnu');

    // La reservation reste tracee : elle est la source de verite du checkout.
    expect(inserted).toHaveLength(1);
  });
});
