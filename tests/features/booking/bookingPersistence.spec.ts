import { describe, expect, it, vi } from 'vitest';
import {
  bookingCreateSchema,
  canEditTrip,
  insertBooking,
  isSensitiveMetadataKey,
  listBookings,
  sanitizeBookingMetadata,
  toPublicBooking,
  type BookingStore,
} from '@/features/booking/server/bookingPersistence';

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-1';

const basePayload = {
  vertical: 'hotel' as const,
  provider: 'routestack' as const,
  external_ref: 'ref-1',
  amount_eur: 120,
  currency: 'EUR',
  status: 'pending' as const,
  checkout_mode: 'deeplink' as const,
  metadata: { title: 'Hôtel' },
};

describe('sanitizeBookingMetadata', () => {
  it('supprime les clés de type secret/credential', () => {
    const out = sanitizeBookingMetadata({
      title: 'Hôtel',
      api_key: 'k',
      accessToken: 't',
      'X-Auth-Token': 't2',
      password: 'p',
      authorization: 'Bearer x',
      client_secret: 's',
    });
    expect(out).toEqual({ title: 'Hôtel' });
    expect(JSON.stringify(out)).not.toMatch(/api_key|accessToken|token|password|authorization|secret/i);
  });

  it('conserve les références opaques non secrètes', () => {
    const out = sanitizeBookingMetadata({
      providerReference: 'opaque-1',
      external_ref: 'ref',
      refreshWindow: 'ok',
    });
    expect(out).toEqual({ providerReference: 'opaque-1', external_ref: 'ref', refreshWindow: 'ok' });
  });

  it('nettoie récursivement les objets imbriqués et borne la profondeur', () => {
    const out = sanitizeBookingMetadata({
      nested: { inner: { apiKey: 'leak', keep: 1 } },
      list: [{ secret: 'x', ok: 'y' }],
    });
    expect(out).toEqual({ nested: { inner: { keep: 1 } }, list: [{ ok: 'y' }] });
  });

  it('renvoie un objet vide pour une entrée non-objet', () => {
    expect(sanitizeBookingMetadata(null)).toEqual({});
    expect(sanitizeBookingMetadata('x')).toEqual({});
    expect(sanitizeBookingMetadata([1, 2])).toEqual({});
  });

  it('borne la profondeur excessive', () => {
    let deep: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 12; i += 1) deep = { child: deep };
    const out = sanitizeBookingMetadata(deep);
    expect(out).toBeDefined();
    expect(typeof out).toBe('object');
  });

  it('tronque les chaînes très longues', () => {
    const out = sanitizeBookingMetadata({ long: 'x'.repeat(5000) });
    expect((out.long as string).length).toBe(2000);
  });
});

describe('isSensitiveMetadataKey', () => {
  it.each([
    ['token', true],
    ['access_token', true],
    ['API-KEY', true],
    ['password', true],
    ['clientSecret', true],
    ['Authorization', true],
    ['providerReference', false],
    ['external_ref', false],
    ['title', false],
  ])('%s -> %s', (key, expected) => {
    expect(isSensitiveMetadataKey(key)).toBe(expected);
  });
});

describe('bookingCreateSchema', () => {
  it('accepte un corps minimal et injecte les défauts', () => {
    const parsed = bookingCreateSchema.safeParse({ vertical: 'car', provider: 'viator' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount_eur).toBe(0);
      expect(parsed.data.currency).toBe('EUR');
      expect(parsed.data.status).toBe('pending');
      expect(parsed.data.checkout_mode).toBe('deeplink');
      expect(parsed.data.metadata).toEqual({});
    }
  });

  it.each([
    ['statut non pending', { ...basePayload, status: 'confirmed' }],
    ['statut held', { ...basePayload, status: 'held' }],
    ['vertical inconnu', { ...basePayload, vertical: 'spaceship' }],
    ['provider inconnu', { ...basePayload, provider: 'unknown' }],
    ['montant négatif', { ...basePayload, amount_eur: -1 }],
    ['devise invalide', { ...basePayload, currency: 'euro' }],
    ['external_ref vide', { ...basePayload, external_ref: '   ' }],
  ])('rejette : %s', (_label, body) => {
    expect(bookingCreateSchema.safeParse(body).success).toBe(false);
  });

  it('rejette les clés inconnues (mass-assignment user_id/trip_id)', () => {
    expect(bookingCreateSchema.safeParse({ ...basePayload, user_id: 'x' }).success).toBe(false);
    expect(bookingCreateSchema.safeParse({ ...basePayload, trip_id: 'x' }).success).toBe(false);
    expect(bookingCreateSchema.safeParse({ ...basePayload, id: 'x' }).success).toBe(false);
  });
});


describe('canEditTrip', () => {
  it('retourne true quand le RPC répond true', async () => {
    const store = { rpc: vi.fn(async () => ({ data: true, error: null })) } as unknown as BookingStore;
    await expect(canEditTrip(store, TRIP_ID)).resolves.toBe(true);
    expect(store.rpc).toHaveBeenCalledWith('can_edit_trip', { p_trip_id: TRIP_ID });
  });

  it('retourne false quand le RPC répond false', async () => {
    const store = { rpc: vi.fn(async () => ({ data: false, error: null })) } as unknown as BookingStore;
    await expect(canEditTrip(store, TRIP_ID)).resolves.toBe(false);
  });

  it('fail-closed sur erreur RPC', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'boom' } })),
    } as unknown as BookingStore;
    await expect(canEditTrip(store, TRIP_ID)).resolves.toBe(false);
  });
});

describe('toPublicBooking', () => {
  it('projette un DTO sans user_id et sans secret', () => {
    const dto = toPublicBooking({
      id: 'b1',
      trip_id: TRIP_ID,
      user_id: 'secret-user',
      vertical: 'hotel',
      provider: 'routestack',
      external_ref: 'ref',
      amount_eur: '99.50',
      currency: 'EUR',
      status: 'pending',
      checkout_mode: 'deeplink',
      metadata: { title: 'H', api_key: 'leak' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(dto).not.toHaveProperty('user_id');
    expect(dto.amount_eur).toBe(99.5);
    expect(dto.metadata).toEqual({ title: 'H' });
  });
});

describe('insertBooking', () => {
  it('force user_id, trip_id et status=pending, et nettoie les métadonnées', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'b1',
        trip_id: TRIP_ID,
        vertical: 'hotel',
        provider: 'routestack',
        external_ref: 'ref-1',
        amount_eur: 120,
        currency: 'EUR',
        status: 'pending',
        checkout_mode: 'deeplink',
        metadata: { title: 'Hôtel' },
        created_at: 'c',
        updated_at: 'u',
      },
      error: null,
    }));
    const insertChain = { select: vi.fn(() => ({ single })) };
    const insert = vi.fn((_row: Record<string, unknown>) => insertChain);
    const from = vi.fn(() => ({ insert }));
    const store = { rpc: vi.fn(), from } as unknown as BookingStore;

    const payload = { ...basePayload, metadata: { title: 'Hôtel', api_key: 'leak' } };
    const result = await insertBooking(store, { tripId: TRIP_ID, userId: USER_ID, payload });

    expect(result.error).toBeNull();
    const inserted = insert.mock.calls[0][0];
    expect(inserted.user_id).toBe(USER_ID);
    expect(inserted.trip_id).toBe(TRIP_ID);
    expect(inserted.status).toBe('pending');
    expect(inserted.metadata).toEqual({ title: 'Hôtel' });
    expect(JSON.stringify(inserted)).not.toContain('leak');
  });

  it('mappe une violation d’unicité (23505) en 409', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const single = vi.fn(async () => ({ data: null, error: { message: 'dup', code: '23505' } }));
    const insertChain = { select: vi.fn(() => ({ single })) };
    const insert = vi.fn((_row: Record<string, unknown>) => insertChain);
    const from = vi.fn(() => ({ insert }));
    const store = { rpc: vi.fn(), from } as unknown as BookingStore;

    const result = await insertBooking(store, { tripId: TRIP_ID, userId: USER_ID, payload: basePayload });
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(409);
  });
});

describe('listBookings', () => {
  it('retourne les réservations nettoyées, les plus récentes d’abord', async () => {
    const order = vi.fn(async () => ({
      data: [
        {
          id: 'b1',
          trip_id: TRIP_ID,
          vertical: 'hotel',
          provider: 'routestack',
          external_ref: null,
          amount_eur: 10,
          currency: 'EUR',
          status: 'pending',
          checkout_mode: 'deeplink',
          metadata: { authorization: 'leak', ok: 1 },
          created_at: 'c',
          updated_at: 'u',
        },
      ],
      error: null,
    }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const store = { rpc: vi.fn(), from } as unknown as BookingStore;

    const result = await listBookings(store, TRIP_ID);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].metadata).toEqual({ ok: 1 });
    expect(select).toHaveBeenCalledWith(expect.stringContaining('id'));
    expect(select).toHaveBeenCalledWith(expect.not.stringContaining('user_id'));
  });

  it('signale une erreur de lecture', async () => {
    const order = vi.fn(async () => ({ data: null, error: { message: 'nope', code: 'XX' } }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const store = { rpc: vi.fn(), from } as unknown as BookingStore;

    const result = await listBookings(store, TRIP_ID);
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(500);
  });
});
