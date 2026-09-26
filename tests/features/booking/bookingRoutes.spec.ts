import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));

import { GET, POST } from '@/app/api/trips/[tripId]/bookings/route';

const USER_ID = 'user-1';
const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const URL = `http://localhost/api/trips/${TRIP_ID}/bookings`;

const SECRET = 'sb_rst_super_secret_value';

const validBody = {
  vertical: 'hotel',
  provider: 'routestack',
  external_ref: 'ref-1',
  amount_eur: 120,
  currency: 'EUR',
  metadata: { title: 'Hôtel', api_key: SECRET, access_token: SECRET },
};

const createdRow = {
  id: 'booking-1',
  trip_id: TRIP_ID,
  user_id: USER_ID,
  vertical: 'hotel',
  provider: 'routestack',
  external_ref: 'ref-1',
  amount_eur: 120,
  currency: 'EUR',
  status: 'pending',
  checkout_mode: 'deeplink',
  metadata: { title: 'Hôtel', api_key: SECRET },
  created_at: '2026-09-26T10:00:00.000Z',
  updated_at: '2026-09-26T10:00:00.000Z',
};

function client(opts: { user: { id: string } | null; canEdit: boolean; insertError?: unknown }) {
  const single = vi.fn(async () =>
    opts.insertError
      ? { data: null, error: opts.insertError as { message: string; code?: string } }
      : { data: createdRow, error: null }
  );
  const insertChain = { select: vi.fn(() => ({ single })) };
  const insert = vi.fn((_row: Record<string, unknown>) => insertChain);

  const order = vi.fn(async () => ({
    data: [createdRow],
    error: null,
  }));
  const selectChain = { eq: vi.fn(() => ({ order })) };
  const select = vi.fn(() => selectChain);

  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: opts.user } })) },
    rpc: vi.fn(async (name: string) => {
      if (name === 'can_edit_trip') return { data: opts.canEdit, error: null };
      return { data: null, error: { message: 'unknown rpc' } };
    }),
    from: vi.fn((table: string) => (table === 'bookings' ? { insert, select } : {})),
    // spies
    _single: single,
    _insert: insert,
    _select: select,
  };
}

function req(body?: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params(tripId = TRIP_ID) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET/POST /api/trips/[tripId]/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(null);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuse sans utilisateur authentifié (401) sur GET et POST', async () => {
    mocks.createClient.mockResolvedValue(client({ user: null, canEdit: false }));

    const getRes = await GET(req(), params());
    expect(getRes.status).toBe(401);
    expect(getRes.headers.get('cache-control')).toBe('no-store');
    await expect(getRes.json()).resolves.toEqual({ error: 'unauthorized' });

    const postRes = await POST(req(validBody), params());
    expect(postRes.status).toBe(401);
    await expect(postRes.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it('interdit un utilisateur non éditeur du voyage (403)', async () => {
    const c = client({ user: { id: USER_ID }, canEdit: false });
    mocks.createClient.mockResolvedValue(c);

    const getRes = await GET(req(), params());
    expect(getRes.status).toBe(403);
    expect(getRes.headers.get('cache-control')).toBe('no-store');
    await expect(getRes.json()).resolves.toEqual({ error: 'forbidden' });

    const postRes = await POST(req(validBody), params());
    expect(postRes.status).toBe(403);
    await expect(postRes.json()).resolves.toEqual({ error: 'forbidden' });
    expect(c._insert).not.toHaveBeenCalled();
  });

  it('rejette un tripId non-UUID (400) sans toucher la base', async () => {
    mocks.createClient.mockResolvedValue(client({ user: { id: USER_ID }, canEdit: true }));

    const res = await POST(req(validBody), params('not-a-uuid'));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_trip' });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON malformé', '{'],
    ['corps non conforme', { vertical: 'hotel' }],
    ['statut non pending', { ...validBody, status: 'confirmed' }],
    ['tentative de user_id', { ...validBody, user_id: 'autre' }],
  ])('valide le corps et renvoie 400 (%s)', async (_label, body) => {
    const c = client({ user: { id: USER_ID }, canEdit: true });
    mocks.createClient.mockResolvedValue(c);

    const res = await POST(req(body), params());
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).error).toBe('invalid_request');
    expect(c._insert).not.toHaveBeenCalled();
  });

  it('refuse un corps supérieur à 32 Kio (413)', async () => {
    mocks.createClient.mockResolvedValue(client({ user: { id: USER_ID }, canEdit: true }));
    const oversized = JSON.stringify({ ...validBody, metadata: { pad: 'x'.repeat(32 * 1024) } });

    const res = await POST(req(oversized), params());
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'payload_too_large' });
  });

  it('propage le rate limit avec 429 sans insérer', async () => {
    const c = client({ user: { id: USER_ID }, canEdit: true });
    mocks.createClient.mockResolvedValue(c);
    mocks.enforceRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'x-ratelimit-remaining': '0' } })
    );

    const res = await POST(req(validBody), params());
    expect(res.status).toBe(429);
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(c._insert).not.toHaveBeenCalled();
  });

  it('crée une réservation pending et force user_id/trip_id (ownership)', async () => {
    const c = client({ user: { id: USER_ID }, canEdit: true });
    mocks.createClient.mockResolvedValue(c);

    const res = await POST(req(validBody), params());

    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');
    expect(body.data.id).toBe('booking-1');

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(USER_ID, {
      scope: 'booking-write',
      limit: 30,
      windowMs: 600_000,
      failMode: 'closed',
    });

    const inserted = c._insert.mock.calls[0][0];
    expect(inserted.user_id).toBe(USER_ID);
    expect(inserted.trip_id).toBe(TRIP_ID);
    expect(inserted.status).toBe('pending');
    // métadonnées sensibles retirées avant écriture
    expect(inserted.metadata).toEqual({ title: 'Hôtel' });
  });

  it('liste les réservations sans secret ni user_id (GET)', async () => {
    const c = client({ user: { id: USER_ID }, canEdit: true });
    mocks.createClient.mockResolvedValue(c);

    const res = await GET(req(), params());
    const raw = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain('user_id');
    expect(raw).not.toContain('api_key');
    expect(JSON.parse(raw).data[0].metadata).toEqual({ title: 'Hôtel' });
  });

  it('ne divulue ni secret ni details internes en cas d’erreur inattendue', async () => {
    const c = client({
      user: { id: USER_ID },
      canEdit: true,
      insertError: { message: `db exploded token=${SECRET}`, code: 'XX000' },
    });
    mocks.createClient.mockResolvedValue(c);

    const res = await POST(req(validBody), params());
    const raw = await res.text();
    expect(res.status).toBe(500);
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain('db exploded');
    expect(JSON.parse(raw)).toEqual({ error: 'booking_create_failed' });
  });

  it('mappe une violation d’unicité en 409 sans divulguer le détail', async () => {
    const c = client({
      user: { id: USER_ID },
      canEdit: true,
      insertError: { message: `duplicate key ${SECRET}`, code: '23505' },
    });
    mocks.createClient.mockResolvedValue(c);

    const res = await POST(req(validBody), params());
    const raw = await res.text();
    expect(res.status).toBe(409);
    expect(raw).not.toContain(SECRET);
  });
});
