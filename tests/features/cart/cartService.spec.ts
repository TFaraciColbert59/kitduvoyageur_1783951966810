import { describe, expect, it, vi } from 'vitest';
import {
  addTripCartLine,
  listTripCart,
  removeTripCartLine,
  updateTripCartLine,
  type CartContext,
} from '@/features/cart/server/cartService';
import { CartError, toPublicCartError } from '@/features/cart/server/cartErrors';
import { CART_MAX_QUANTITY_PER_LINE } from '@/features/cart/cartTypes';
import { addCartLineSchema, updateCartLineSchema } from '@/features/cart/schemas/cartSchemas';
import { cartLineRow, createFakeSupabase, type TableHandler } from './fakeSupabase';

const USER = 'user-1';
const TRIP = 'trip-1';
const PRODUCT_REF = '22222222-2222-4222-8222-222222222222';
const BOOKING_REF = '33333333-3333-4333-8333-333333333333';
const LINE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TRIP_OWNER = 'user-2';

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_REF,
    slug: 'parapluie-pliant',
    name: 'Parapluie pliant',
    brand: 'Kord',
    category: 'Imperméables',
    image: 'https://images.unsplash.com/photo-1',
    image_alt: 'Parapluie pliant',
    weight_g: 320,
    price_eur: 39.9,
    available: true,
    is_active: true,
    ...overrides,
  };
}

interface Scenario {
  tables: Record<string, TableHandler>;
  rpc?: (name: string) => Promise<{ data: unknown; error: null }>;
}

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    tables: {
      trips: (_op, state) => {
        if (state.filters.id === TRIP) {
          return { data: { id: TRIP, user_id: USER }, error: null };
        }
        if (state.filters.id === 'trip-2') {
          return { data: { id: 'trip-2', user_id: OTHER_TRIP_OWNER }, error: null };
        }
        return { data: null, error: null };
      },
      shop_products: (_op, state) => {
        if (state.filters.id === PRODUCT_REF) {
          return { data: productRow(), error: null };
        }
        return { data: null, error: null };
      },
      bookings: (_op, state) => {
        if (state.filters.id === BOOKING_REF) {
          return {
            data: {
              id: BOOKING_REF,
              amount_eur: 128.5,
              currency: 'EUR',
              vertical: 'hotel',
              provider: 'routestack',
              status: 'pending',
              metadata: { title: 'Hôtel de démo', deeplink: 'https://www.routestack.com/o/1' },
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      cart_lines: () => ({ data: null, error: null }),
      ...overrides.tables,
    },
    ...(overrides.rpc ? { rpc: overrides.rpc } : {}),
  };
}

function context(overrides: Partial<Scenario> = {}, userId = USER): CartContext {
  const config = scenario(overrides);
  return {
    supabase: createFakeSupabase({
      tables: config.tables,
      userId,
      rpc: config.rpc ? (name) => config.rpc!(name) : undefined,
    }) as never,
    userId,
    tripId: TRIP,
  };
}

function addInput(payload: Record<string, unknown>) {
  const parsed = addCartLineSchema.safeParse(payload);
  if (!parsed.success) throw new Error('charge utile de test invalide');
  return parsed.data;
}

describe('cartService — lecture du panier', () => {
  it('liste les lignes du propriétaire et calcule les totaux', async () => {
    const lines = [
      cartLineRow({ id: LINE_ID, quantity: 2, unit_price_eur: 39.9 }),
      cartLineRow({
        id: '44444444-4444-4444-8444-444444444444',
        kind: 'booking',
        ref_id: BOOKING_REF,
        quantity: 1,
        unit_price_eur: 128.5,
      }),
    ];
    const cart = await listTripCart(
      context({
        tables: {
          cart_lines: (_op, state) => {
            expect(state.filters.user_id).toBe(USER);
            expect(state.filters.trip_id).toBe(TRIP);
            return { data: lines, error: null };
          },
        },
      })
    );

    expect(cart.lines).toHaveLength(2);
    expect(cart.totals.lineCount).toBe(2);
    expect(cart.totals.itemCount).toBe(3);
    expect(cart.totals.totalEur).toBe(208.3);
  });

  it('refuse un voyage inexistant en 404', async () => {
    const cart = context();
    await expect(listTripCart({ ...cart, tripId: 'trip-404' })).rejects.toMatchObject({
      code: 'trip_not_found',
    });
  });

  it('refuse la lecture si l\'utilisateur n\'a aucun droit sur le voyage', async () => {
    const cart = context({ rpc: async () => ({ data: false, error: null }) });
    await expect(listTripCart({ ...cart, tripId: 'trip-2' })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('autorise un collaborateur lecteur via can_read_trip', async () => {
    const calls: string[] = [];
    const cart = context({
      rpc: async (name) => {
        calls.push(name);
        return { data: true, error: null };
      },
      tables: { cart_lines: () => ({ data: [], error: null }) },
    });
    const view = await listTripCart({ ...cart, tripId: 'trip-2' });
    expect(calls).toEqual(['can_read_trip']);
    expect(view.lines).toEqual([]);
  });
});

describe('cartService — ajout', () => {
  it('insère une ligne avec le prix résolu côté serveur', async () => {
    let inserted: Record<string, unknown> | null = null;
    const cart = context({
      tables: {
        cart_lines: (op) => {
          if (op.type === 'insert') {
            inserted = op.payload as Record<string, unknown>;
            return {
              data: cartLineRow({
                id: LINE_ID,
                quantity: 2,
                unit_price_eur: 39.9,
                metadata: { title: 'Parapluie pliant', slug: 'parapluie-pliant' },
              }),
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    });

    const result = await addTripCartLine(
      cart,
      addInput({
        kind: 'product',
        refId: PRODUCT_REF,
        quantity: 2,
        // Le client propose un prix et une clé stranger : les deux sont ignorés.
        metadata: { title: 'Titre client', slug: 'parapluie-pliant' },
      })
    );

    expect(result.created).toBe(true);
    expect(result.line.unitPriceEur).toBe(39.9);
    expect(inserted).toMatchObject({
      user_id: USER,
      trip_id: TRIP,
      kind: 'product',
      ref_id: PRODUCT_REF,
      quantity: 2,
      unit_price_eur: 39.9,
    });
    // Le libellé serveur gagne sur le libellé client.
    expect(inserted!.metadata).toMatchObject({ title: 'Parapluie pliant' });
  });

  it('fusionne les quantités sur une référence déjà présente', async () => {
    let updated: Record<string, unknown> | null = null;
    const cart = context({
      tables: {
        cart_lines: (op) => {
          if (op.type === 'select') {
            return { data: cartLineRow({ quantity: 2 }), error: null };
          }
          if (op.type === 'update') {
            updated = op.payload as Record<string, unknown>;
            return { data: cartLineRow({ quantity: 3 }), error: null };
          }
          return { data: null, error: null };
        },
      },
    });

    const result = await addTripCartLine(cart, addInput({ kind: 'product', refId: PRODUCT_REF }));

    expect(result.created).toBe(false);
    expect(result.deduplicated).toBe(false);
    expect(updated).toMatchObject({ quantity: 3 });
  });

  it('absorbe un second appel portant la même clé d\'idempotence', async () => {
    const updateSpy = vi.fn();
    const cart = context({
      tables: {
        cart_lines: (op) => {
          if (op.type === 'select') {
            return {
              data: cartLineRow({ quantity: 2, metadata: { title: 'X', idempotencyKey: 'order-1712:aa' } }),
              error: null,
            };
          }
          updateSpy(op);
          return { data: cartLineRow({ quantity: 9 }), error: null };
        },
      },
    });

    const result = await addTripCartLine(
      cart,
      addInput({ kind: 'product', refId: PRODUCT_REF, quantity: 3, idempotencyKey: 'order-1712:aa' })
    );

    expect(result.deduplicated).toBe(true);
    expect(result.line.quantity).toBe(2);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('borne la quantité cumulée à la limite par ligne', async () => {
    let updated: Record<string, unknown> | null = null;
    const cart = context({
      tables: {
        cart_lines: (op) => {
          if (op.type === 'select') {
            return {
              data: cartLineRow({ quantity: CART_MAX_QUANTITY_PER_LINE - 1 }),
              error: null,
            };
          }
          updated = op.payload as Record<string, unknown>;
          return { data: cartLineRow({ quantity: CART_MAX_QUANTITY_PER_LINE }), error: null };
        },
      },
    });

    await addTripCartLine(
      cart,
      addInput({ kind: 'product', refId: PRODUCT_REF, quantity: CART_MAX_QUANTITY_PER_LINE })
    );
    expect(updated).toMatchObject({ quantity: CART_MAX_QUANTITY_PER_LINE });
  });

  it('refuse un produit indisponible (invalid_reference)', async () => {
    const cart = context({
      tables: { shop_products: () => ({ data: productRow({ available: false }), error: null }) },
    });
    await expect(
      addTripCartLine(cart, addInput({ kind: 'product', refId: PRODUCT_REF }))
    ).rejects.toMatchObject({ code: 'invalid_reference' });
  });

  it('refuse une réservation qui n\'appartient pas au voyage', async () => {
    const cart = context({
      tables: {
        bookings: (_op, state) => {
          expect(state.filters.trip_id).toBe(TRIP);
          expect(state.filters.user_id).toBe(USER);
          return { data: null, error: null };
        },
      },
    });
    await expect(
      addTripCartLine(cart, addInput({ kind: 'booking', refId: BOOKING_REF }))
    ).rejects.toMatchObject({ code: 'invalid_reference' });
  });

  it('ajoute une réservation en copiant montant et devise serveur', async () => {
    let inserted: Record<string, unknown> | null = null;
    const cart = context({
      tables: {
        cart_lines: (op) => {
          if (op.type === 'insert') {
            inserted = op.payload as Record<string, unknown>;
            return {
              data: cartLineRow({ id: LINE_ID, kind: 'booking', ref_id: BOOKING_REF, unit_price_eur: 128.5 }),
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    });

    const result = await addTripCartLine(
      cart,
      addInput({ kind: 'booking', refId: BOOKING_REF, metadata: { title: 'Mensonge', deeplink: 'javascript:alert(1)' } })
    );

    expect(result.line.unitPriceEur).toBe(128.5);
    expect(inserted!.metadata).toMatchObject({
      title: 'Hôtel de démo',
      deeplink: 'https://www.routestack.com/o/1',
    });
  });

  it('relit et fusionne après une violation d\'unicité (course concurrente)', async () => {
    let selectCount = 0;
    const cart = context({
      tables: {
        cart_lines: (op) => {
          if (op.type === 'insert') {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          selectCount += 1;
          return {
            data: cartLineRow({ quantity: selectCount === 1 ? 1 : 4 }),
            error: null,
          };
        },
      },
    });

    const result = await addTripCartLine(
      cart,
      addInput({ kind: 'product', refId: PRODUCT_REF, quantity: 3 })
    );
    expect(result.created).toBe(false);
    expect(result.line.quantity).toBe(4);
  });

  it('refuse l\'écriture quand le voyage appartient à un autre utilisateur', async () => {
    const cart = context({ rpc: async () => ({ data: false, error: null }) });
    await expect(
      addTripCartLine({ ...cart, tripId: 'trip-2' }, addInput({ kind: 'product', refId: PRODUCT_REF }))
    ).rejects.toBeInstanceOf(CartError);
  });

  it('n\'expose aucun secret dans le message d\'erreur', async () => {
    const cart = context({
      tables: {
        shop_products: () => ({
          data: null,
          error: { code: '42501', message: 'permission denied for sb_rst_secret_token' },
        }),
      },
    });
    const error = (await addTripCartLine(
      cart,
      addInput({ kind: 'product', refId: PRODUCT_REF })
    ).then(
      () => null,
      (caught: unknown) => caught
    )) as CartError;
    // Le message reste dans les logs serveur ; la projection publique, elle,
    // ne contient qu'un code stable.
    expect(error.code).toBe('forbidden');
    expect(JSON.stringify(toPublicCartError(error))).not.toContain('sb_rst_secret_token');
    expect(JSON.stringify(toPublicCartError(error))).toBe('{"error":"forbidden"}');
  });
});

describe('cartService — mise à jour', () => {
  it('met à jour la quantité en gardant la clé d\'idempotence', async () => {
    let updated: Record<string, unknown> | null = null;
    const cart = context({
      tables: {
        cart_lines: (op) => {
          if (op.type === 'update') {
            updated = op.payload as Record<string, unknown>;
            return { data: cartLineRow({ quantity: 5 }), error: null };
          }
          return {
            data: cartLineRow({ metadata: { title: 'Parapluie', idempotencyKey: 'order-1712:aa' } }),
            error: null,
          };
        },
      },
    });

    const line = await updateTripCartLine(cart, LINE_ID, updateCartLineSchema.parse({ quantity: 5 }));

    expect(line.quantity).toBe(5);
    expect(updated).toMatchObject({ quantity: 5 });
  });

  it('assainit les métadonnées sans prix ni clé étrangère', async () => {
    let updated: Record<string, unknown> | null = null;
    const cart = context({
      tables: {
        cart_lines: (op) => {
          if (op.type === 'update') {
            updated = op.payload as Record<string, unknown>;
            return { data: cartLineRow(), error: null };
          }
          return { data: cartLineRow(), error: null };
        },
      },
    });

    await updateTripCartLine(
      cart,
      LINE_ID,
      updateCartLineSchema.parse({ metadata: { title: 'Nouveau', token: 'sb_secret' } })
    );
    expect(updated!.metadata).toEqual({ title: 'Nouveau' });
  });

  it('refuse une ligne absente ou appartenant à un autre panier', async () => {
    const cart = context({ tables: { cart_lines: () => ({ data: null, error: null }) } });
    await expect(
      updateTripCartLine(cart, LINE_ID, updateCartLineSchema.parse({ quantity: 2 }))
    ).rejects.toMatchObject({ code: 'line_not_found' });
  });

  it('interdit la modification du prix unitaire', async () => {
    expect(updateCartLineSchema.safeParse({ unitPriceEur: 0 }).success).toBe(false);
    expect(updateCartLineSchema.safeParse({ unit_price_eur: 0 }).success).toBe(false);

    const cart = context({
      tables: {
        cart_lines: (op) =>
          op.type === 'update'
            ? { data: cartLineRow({ unit_price_eur: 39.9 }), error: null }
            : { data: cartLineRow({ unit_price_eur: 39.9 }), error: null },
      },
    });
    const line = await updateTripCartLine(cart, LINE_ID, updateCartLineSchema.parse({ quantity: 1 }));
    expect(line.unitPriceEur).toBe(39.9);
  });
});

describe('cartService — suppression', () => {
  it('supprime la ligne du propriétaire', async () => {
    const cart = context({
      tables: {
        cart_lines: (op, state) => {
          expect(op.type).toBe('delete');
          expect(state.filters.id).toBe(LINE_ID);
          expect(state.filters.user_id).toBe(USER);
          return { data: { id: LINE_ID }, error: null };
        },
      },
    });

    await expect(removeTripCartLine(cart, LINE_ID)).resolves.toEqual({
      id: LINE_ID,
      removed: true,
    });
  });

  it('renvoie line_not_found quand rien n\'a été supprimé', async () => {
    const cart = context({ tables: { cart_lines: () => ({ data: null, error: null }) } });
    await expect(removeTripCartLine(cart, LINE_ID)).rejects.toMatchObject({
      code: 'line_not_found',
    });
  });
});
