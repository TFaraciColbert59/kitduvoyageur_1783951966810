import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { cartLineRow, createFakeSupabase, type TableHandler } from './fakeSupabase';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET, POST } from '@/app/api/trips/[tripId]/cart-lines/route';
import { DELETE, PATCH } from '@/app/api/trips/[tripId]/cart-lines/[lineId]/route';

const USER = 'user-1';
const TRIP = '33333333-3333-4333-8333-333333333333';
const LINE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_REF = '22222222-2222-4222-8222-222222222222';
const COLLECTION_URL = 'http://localhost/api/trips/' + TRIP + '/cart-lines';

function tables(overrides: Record<string, TableHandler> = {}): Record<string, TableHandler> {
  return {
    trips: (_op, state) =>
      state.filters.id === TRIP
        ? { data: { id: TRIP, user_id: USER }, error: null }
        : { data: null, error: null },
    shop_products: (_op, state) =>
      state.filters.id === PRODUCT_REF
        ? {
            data: {
              id: PRODUCT_REF,
              slug: 'parapluie',
              name: 'Parapluie',
              brand: 'Kord',
              category: '',
              image: 'https://images.unsplash.com/photo-1',
              image_alt: '',
              weight_g: 320,
              price_eur: 39.9,
              available: true,
              is_active: true,
            },
            error: null,
          }
        : { data: null, error: null },
    cart_lines: () => ({ data: null, error: null }),
    ...overrides,
  };
}

function useSupabase(tableOverrides: Record<string, TableHandler> = {}, userId: string | null = USER) {
  mocks.createClient.mockResolvedValue(
    createFakeSupabase({ tables: tables(tableOverrides), userId }) as never
  );
}

function collectionRequest(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(COLLECTION_URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}

function lineRequest(method: string, body?: unknown) {
  return new NextRequest(COLLECTION_URL + '/' + LINE_ID, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const params = (tripId = TRIP) => ({ params: Promise.resolve({ tripId }) });
const lineParams = (lineId = LINE_ID) => ({ params: Promise.resolve({ tripId: TRIP, lineId }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/trips/:tripId/cart-lines', () => {
  it('refuse un appel sans session avec 401', async () => {
    useSupabase({}, null);
    const response = await GET(collectionRequest('GET'), params());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it('renvoie le panier et les totaux en no-store', async () => {
    useSupabase({
      cart_lines: () => ({
        data: [cartLineRow({ id: LINE_ID, user_id: USER, trip_id: TRIP, quantity: 2 })],
        error: null,
      }),
    });

    const response = await GET(collectionRequest('GET'), params());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.totals).toEqual({
      lineCount: 1,
      itemCount: 2,
      totalEur: 99.8,
      currency: 'EUR',
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(USER, {
      scope: 'cart-read',
      limit: 120,
      windowMs: 60_000,
      failMode: 'open',
    });
  });

  it('refuse un tripId non UUID avec 400', async () => {
    useSupabase();
    const response = await GET(collectionRequest('GET'), params('trip-1'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_request', fields: ['tripId'] });
  });

  it('renvoie 404 pour un voyage absent', async () => {
    useSupabase();
    const response = await GET(collectionRequest('GET'), params('44444444-4444-4444-8444-444444444444'));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'trip_not_found' });
  });

  it('propage le refus de quota sans interroger la base', async () => {
    useSupabase();
    mocks.enforceRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    );
    const response = await GET(collectionRequest('GET'), params());
    expect(response.status).toBe(429);
  });
});

describe('POST /api/trips/:tripId/cart-lines', () => {
  const validBody = { kind: 'product', refId: PRODUCT_REF, quantity: 2 };

  it('crée une ligne avec 201 et un cache privé', async () => {
    useSupabase({
      cart_lines: (op) =>
        op.type === 'insert'
          ? { data: cartLineRow({ id: LINE_ID, ...(op.payload as Record<string, unknown>) }), error: null }
          : { data: null, error: null },
    });

    const response = await POST(collectionRequest('POST', validBody), params());

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ success: true, created: true, deduplicated: false });
    expect(body.data.unitPriceEur).toBe(39.9);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(USER, {
      scope: 'cart-write',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
  });

  it('renvoie 200 et deduplicated quand la ligne existe déjà', async () => {
    useSupabase({
      cart_lines: (op) =>
        op.type === 'update'
          ? { data: cartLineRow({ id: LINE_ID, user_id: USER, trip_id: TRIP, quantity: 3 }), error: null }
          : { data: cartLineRow({ id: LINE_ID, user_id: USER, trip_id: TRIP, quantity: 1 }), error: null },
    });

    const response = await POST(collectionRequest('POST', validBody), params());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ created: false, deduplicated: false });
  });

  it('refuse un JSON malformé avec 400', async () => {
    useSupabase();
    const response = await POST(collectionRequest('POST', '{'), params());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_request' });
  });

  it('refuse un corps supérieur à 32 Kio avec 413', async () => {
    useSupabase();
    const response = await POST(
      collectionRequest('POST', { ...validBody, padding: 'x'.repeat(32 * 1024) }),
      params()
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: 'payload_too_large' });
  });

  it('refuse un content-length menteur avec 413', async () => {
    useSupabase();
    const response = await POST(
      collectionRequest('POST', validBody, { 'content-length': String(64 * 1024) }),
      params()
    );
    expect(response.status).toBe(413);
  });

  it('liste les champs refusés sur une charge utile invalide', async () => {
    useSupabase();
    const response = await POST(
      collectionRequest('POST', { kind: 'produit', refId: 'pas-un-uuid', quantity: 900 }),
      params()
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_request');
    expect(body.fields).toEqual(expect.arrayContaining(['kind', 'refId', 'quantity']));
  });

  it('renvoie 422 sur une référence produit inconnue', async () => {
    useSupabase();
    const response = await POST(
      collectionRequest('POST', { kind: 'product', refId: '55555555-5555-4555-8555-555555555555' }),
      params()
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_reference' });
  });

  it('ne divulgue ni token ni détail Supabase sur une erreur inattendue', async () => {
    useSupabase({
      shop_products: () => ({
        data: null,
        error: { code: 'XX000', message: 'crash interne sb_rst_EXAMPLE_LEAKED_TOKEN_0000' },
      }),
    });
    const response = await POST(collectionRequest('POST', validBody), params());
    const raw = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(raw).not.toContain('sb_rst_EXAMPLE_LEAKED_TOKEN_0000');
    expect(raw).not.toContain('stack');
    expect(raw).toBe('{"error":"internal"}');
  });
});

describe('PATCH /api/trips/:tripId/cart-lines/:lineId', () => {
  it('met à jour la quantité', async () => {
    useSupabase({
      cart_lines: (op) =>
        op.type === 'update'
          ? { data: cartLineRow({ id: LINE_ID, user_id: USER, trip_id: TRIP, quantity: 4 }), error: null }
          : { data: cartLineRow({ id: LINE_ID, user_id: USER, trip_id: TRIP }), error: null },
    });

    const response = await PATCH(lineRequest('PATCH', { quantity: 4 }), lineParams());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: LINE_ID, quantity: 4 },
    });
  });

  it('refuse une ligne qui appartient à un autre panier', async () => {
    useSupabase({
      // La ligne existe (id LINE_ID) mais appartient a un autre panier : le
      // filtre `user_id = USER` la rend invisible, exactement comme sous RLS.
      cart_lines: (_op, state) => {
        const row = cartLineRow({ id: LINE_ID, user_id: 'user-2' });
        if (state.filters.user_id !== row.user_id) return { data: null, error: null };
        return { data: row, error: null };
      },
    });

    const response = await PATCH(lineRequest('PATCH', { quantity: 2 }), lineParams());
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'line_not_found' });
  });

  it('refuse un lineId non UUID avec 400', async () => {
    useSupabase();
    const response = await PATCH(lineRequest('PATCH', { quantity: 2 }), lineParams('ligne-1'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_request', fields: ['lineId'] });
  });

  it('refuse un corps vide avec 400', async () => {
    useSupabase();
    const response = await PATCH(lineRequest('PATCH', {}), lineParams());
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/trips/:tripId/cart-lines/:lineId', () => {
  it('supprime la ligne en no-store', async () => {
    useSupabase({ cart_lines: () => ({ data: { id: LINE_ID }, error: null }) });
    const response = await DELETE(lineRequest('DELETE'), lineParams());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: LINE_ID, removed: true },
    });
  });

  it('renvoie 404 si rien n\'a été supprimé', async () => {
    useSupabase({ cart_lines: () => ({ data: null, error: null }) });
    const response = await DELETE(lineRequest('DELETE'), lineParams());
    expect(response.status).toBe(404);
  });

  it('exige une session', async () => {
    useSupabase({}, null);
    const response = await DELETE(lineRequest('DELETE'), lineParams());
    expect(response.status).toBe(401);
  });
});
