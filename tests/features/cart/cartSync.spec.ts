import { describe, expect, it, vi } from 'vitest';
import {
  cartLineEndpoint,
  cartLinesEndpoint,
  importLocalCartToTrip,
  isServerReferenceId,
  localItemToAddPayload,
  planLocalCartImport,
  remoteCartLinesToLocalItems,
  type CartTransport,
  type LocalCartItemLike,
} from '@/features/cart/client/cartSync';
import { CART_MAX_QUANTITY_PER_LINE, type CartLine } from '@/features/cart/cartTypes';

const REF = '22222222-2222-4222-8222-222222222222';
const OTHER_REF = '44444444-4444-4444-8444-444444444444';
const TRIP = '33333333-3333-4333-8333-333333333333';

function localItem(overrides: Partial<LocalCartItemLike> = {}): LocalCartItemLike {
  return {
    id: REF,
    slug: 'parapluie',
    name: 'Parapluie compact',
    brand: 'Kord',
    priceEur: 39.9,
    weightG: 320,
    image: 'https://images.example/parapluie.jpg',
    imageAlt: 'Parapluie pliant',
    quantity: 2,
    category: 'meteo',
    ...overrides,
  };
}

function cartLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    tripId: TRIP,
    kind: 'product',
    refId: REF,
    quantity: 1,
    unitPriceEur: 39.9,
    currency: 'EUR',
    metadata: { title: 'Parapluie compact' },
    createdAt: '2026-09-26T10:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
    ...overrides,
  };
}

describe('isServerReferenceId', () => {
  it('accepte un UUID et refuse les identifiants locaux', () => {
    expect(isServerReferenceId(REF)).toBe(true);
    expect(isServerReferenceId(REF.toUpperCase())).toBe(true);
    expect(isServerReferenceId('kit-achat-2024')).toBe(false);
    expect(isServerReferenceId('local-1')).toBe(false);
    expect(isServerReferenceId('')).toBe(false);
  });
});

describe('localItemToAddPayload', () => {
  it('renvoie null pour un identifiant non UUID', () => {
    expect(localItemToAddPayload(localItem({ id: 'kit-achat-2024' }))).toBeNull();
  });

  it('ne transmet jamais le prix local', () => {
    const payload = localItemToAddPayload(localItem({ priceEur: 0.01 }));

    expect(payload).not.toBeNull();
    const body = JSON.stringify(payload);
    expect(body).not.toContain('priceEur');
    expect(body).not.toContain('0.01');
  });

  it('borne la quantité et conserve un minimum de 1', () => {
    expect(localItemToAddPayload(localItem({ quantity: 500 }))?.quantity).toBe(
      CART_MAX_QUANTITY_PER_LINE
    );
    expect(localItemToAddPayload(localItem({ quantity: 0 }))?.quantity).toBe(1);
    expect(localItemToAddPayload(localItem({ quantity: -3 }))?.quantity).toBe(1);
    expect(localItemToAddPayload(localItem({ quantity: Number.NaN }))?.quantity).toBe(1);
  });

  it('conserve les métadonnées http(s) et rejette une image non http', () => {
    const good = localItemToAddPayload(localItem());
    expect(good?.metadata).toMatchObject({
      title: 'Parapluie compact',
      slug: 'parapluie',
      brand: 'Kord',
      category: 'meteo',
      image: 'https://images.example/parapluie.jpg',
      imageAlt: 'Parapluie pliant',
      weightG: 320,
    });

    const bad = localItemToAddPayload(
      localItem({ image: 'javascript:alert(1)', imageAlt: undefined })
    );
    expect(bad?.metadata).not.toHaveProperty('image');
    expect(bad?.metadata).not.toHaveProperty('imageAlt');
  });

  it('arrondit et ne laisse pas passer un poids négatif ou infini', () => {
    expect(localItemToAddPayload(localItem({ weightG: 320.6 }))?.metadata.weightG).toBe(321);
    expect(localItemToAddPayload(localItem({ weightG: -10 }))?.metadata.weightG).toBe(0);
    expect(localItemToAddPayload(localItem({ weightG: Number.POSITIVE_INFINITY }))?.metadata).not
      .toHaveProperty('weightG');
  });
});

describe('planLocalCartImport', () => {
  it('sépare les charges utiles acceptables des identifiants ignorés', () => {
    const plan = planLocalCartImport([
      localItem({ id: REF }),
      localItem({ id: 'kit-achat-2024' }),
      localItem({ id: OTHER_REF, name: 'Lampe' }),
    ]);

    expect(plan.payloads).toHaveLength(2);
    expect(plan.skipped).toEqual(['kit-achat-2024']);
    expect(plan.payloads.map((payload) => payload.refId)).toEqual([REF, OTHER_REF]);
  });

  it('retourne un plan vide pour un panier vide', () => {
    expect(planLocalCartImport([])).toEqual({ payloads: [], skipped: [] });
  });
});

describe('importLocalCartToTrip', () => {
  it('poste chaque ligne sur /api/trips/:id/cart-lines', async () => {
    const transport = vi.fn<CartTransport>(async () => ({ ok: true, status: 201 }));

    const report = await importLocalCartToTrip([localItem({ id: REF }), localItem({ id: OTHER_REF })], {
      tripId: TRIP,
      transport,
    });

    expect(report).toEqual({ synced: 2, skipped: 0, failed: [] });
    expect(transport).toHaveBeenCalledTimes(2);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe('/api/trips/' + TRIP + '/cart-lines');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ kind: 'product', refId: REF, quantity: 2 });
  });

  it('rapporte les réponses en erreur sans lancer d exception', async () => {
    const transport = vi.fn<CartTransport>(async (_url, init) =>
      JSON.parse(init.body).refId === OTHER_REF ? { ok: false, status: 422 } : { ok: true, status: 201 }
    );

    const report = await importLocalCartToTrip([localItem({ id: REF }), localItem({ id: OTHER_REF })], {
      tripId: TRIP,
      transport,
    });

    expect(report).toEqual({ synced: 1, skipped: 0, failed: [OTHER_REF] });
  });

  it('capture une exception réseau et la convertit en échec', async () => {
    const transport = vi.fn<CartTransport>(async () => {
      throw new Error('offline');
    });

    const report = await importLocalCartToTrip([localItem()], { tripId: TRIP, transport });

    expect(report).toEqual({ synced: 0, skipped: 0, failed: [REF] });
  });

  it('compte les entrées ignorées sans les envoyer', async () => {
    const transport = vi.fn<CartTransport>(async () => ({ ok: true, status: 201 }));

    const report = await importLocalCartToTrip([localItem({ id: 'kit-achat-2024' })], {
      tripId: TRIP,
      transport,
    });

    expect(report).toEqual({ synced: 0, skipped: 1, failed: [] });
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('remoteCartLinesToLocalItems', () => {
  it('ne projette que les lignes produit', () => {
    const items = remoteCartLinesToLocalItems([
      cartLine({ kind: 'product' }),
      cartLine({ kind: 'booking', refId: OTHER_REF, metadata: { title: 'Hotel' } }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(REF);
  });

  it('applique des valeurs par défaut quand les métadonnées manquent', () => {
    const [item] = remoteCartLinesToLocalItems([cartLine({ metadata: {} })]);

    expect(item).toMatchObject({ name: 'Produit', weightG: 0, image: '', imageAlt: '', category: '' });
    expect(item.slug).toBeUndefined();
  });

  it('borne la quantité renvoyée à l affichage', () => {
    const [item] = remoteCartLinesToLocalItems([cartLine({ quantity: 500 })]);

    expect(item.quantity).toBe(CART_MAX_QUANTITY_PER_LINE);
  });
});

describe('endpoints', () => {
  it('construit les URL de collection et de ligne', () => {
    expect(cartLinesEndpoint(TRIP)).toBe('/api/trips/' + TRIP + '/cart-lines');
    expect(cartLineEndpoint(TRIP, 'ligne 1')).toBe(
      '/api/trips/' + TRIP + '/cart-lines/' + encodeURIComponent('ligne 1')
    );
  });
});
