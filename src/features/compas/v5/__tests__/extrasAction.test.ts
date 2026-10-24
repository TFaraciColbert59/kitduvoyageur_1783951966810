import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from './fakeDb';

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  user: { id: 'u1' } as { id: string } | null,
  refuse: false,
  rateCalls: [] as Array<{ scope: string; limit: number; windowMs: number; failMode?: string }>,
  links: [] as unknown[],
  linksError: false,
  loaded: [] as Array<{ data: Record<string, unknown>; tripId: string }>,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    ...(h.db.client as object),
    auth: { getUser: async () => ({ data: { user: h.user } }) },
  })),
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string; limit: number; windowMs: number; failMode?: string }) => {
    h.rateCalls.push(config);
    return h.refuse ? new Response(null, { status: 429 }) : null;
  }),
}));
vi.mock('@/lib/queries-affiliation', () => ({
  getAffiliateLinks: vi.fn(async () => {
    if (h.linksError) throw new Error('affiliation');
    return h.links;
  }),
}));
vi.mock('../server/extras', () => ({
  loadV5Extras: vi.fn(async (args: { data: Record<string, unknown>; trip: { id: string } }) => {
    h.loaded.push({ data: args.data, tripId: args.trip.id });
    return { nights: {}, dayPhotos: {}, transport: [], fetchedAt: '2026-10-22T10:00:00.000Z', unavailable: [], choices: { transport: null, stays: {} }, partial: false };
  }),
}));

import { compasV5ExtrasAction } from '../server/extrasAction';

const TRIP = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  h.db = createFakeDb({
    trips: [
      {
        id: TRIP,
        user_id: 'u1',
        title: 'Rando',
        destination_name: 'Vercors',
        destination_country_code: 'FR',
        party_size: 3,
        metadata: {},
      },
    ],
    trip_steps: [
      { id: 'a', trip_id: TRIP, day_number: 1, order_index: 0, latitude: '45.0', longitude: 5.4, accommodation_name: null },
      { id: 'b', trip_id: TRIP, day_number: 2, order_index: 0, latitude: null, longitude: null, accommodation_name: 'Gîte' },
    ],
  });
  h.user = { id: 'u1' };
  h.refuse = false;
  h.rateCalls = [];
  h.links = [];
  h.linksError = false;
  h.loaded = [];
});

describe('compasV5ExtrasAction', () => {
  it('lit les extras du voyage avec les étapes, jamais une étape sans position à (0, 0)', async () => {
    const res = await compasV5ExtrasAction({ tripId: TRIP });
    expect(res.success).toBe(true);
    const { data, tripId } = h.loaded[0];
    expect(tripId).toBe(TRIP);
    expect(data.itinerary).toEqual([
      { id: 'a', day: 1, accommodation: null },
      { id: 'b', day: 2, accommodation: 'Gîte' },
    ]);
    expect(data.points).toEqual([{ id: 's-a', lat: 45, lon: 5.4, kind: 'step' }]);
    expect(data.countryCode).toBe('FR');
    expect(data.model).toEqual({ crew: { size: 3 } });
  });

  it('compte la lecture par personne : 20 par 10 minutes, ouverte en cas de panne du compteur', async () => {
    await compasV5ExtrasAction({ tripId: TRIP });
    expect(h.rateCalls).toEqual([{ scope: 'compas-v5-extras', limit: 20, windowMs: 600_000, failMode: 'open' }]);
  });

  it('limite atteinte : rien n’est lu, et l’écran sait que tout est indisponible', async () => {
    h.refuse = true;
    const res = await compasV5ExtrasAction({ tripId: TRIP });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.extras.unavailable).toEqual(['lodging', 'photos', 'transport']);
      expect(res.extras.nights).toEqual({});
      expect(res.extras.partial).toBe(false);
    }
    expect(h.loaded).toHaveLength(0);
  });

  it('refuse un identifiant invalide', async () => {
    expect(await compasV5ExtrasAction({ tripId: 'pas-un-uuid' })).toEqual({ success: false, error: 'Voyage invalide' });
    expect(await compasV5ExtrasAction({} as never)).toEqual({ success: false, error: 'Voyage invalide' });
    expect(h.loaded).toHaveLength(0);
  });

  it('exige une session', async () => {
    h.user = null;
    expect(await compasV5ExtrasAction({ tripId: TRIP })).toEqual({
      success: false,
      error: 'Connecte-toi pour voir les points autour.',
    });
    expect(h.rateCalls).toHaveLength(0);
    expect(h.loaded).toHaveLength(0);
  });

  it('voyage illisible sous RLS (ou inexistant) : introuvable', async () => {
    const res = await compasV5ExtrasAction({ tripId: '22222222-2222-4222-8222-222222222222' });
    expect(res).toEqual({ success: false, error: 'Voyage introuvable ou non autorisé.' });
    expect(h.loaded).toHaveLength(0);
  });

  it('les liens partenaires du pays : relais /go/, et une panne ne fait pas échouer la lecture', async () => {
    h.links = [
      { id: '1', slug: 'covoiturage-fr', category: 'transport', country_code: 'FR', title: 'Covoiturage en France', destination_name: null, partner: { name: 'BlaBlaCar' } },
      { id: '2', slug: 'hotels-chamonix', category: 'hotel', country_code: 'FR', title: 'Hôtels à Chamonix', destination_name: 'Chamonix', partner: { name: 'Booking' } },
    ];
    await compasV5ExtrasAction({ tripId: TRIP });
    expect(h.loaded[0].data.affiliateLinks).toEqual([{ label: 'Covoiturage en France', partner: 'BlaBlaCar', url: '/go/covoiturage-fr' }]);

    h.linksError = true;
    expect((await compasV5ExtrasAction({ tripId: TRIP })).success).toBe(true);
    expect(h.loaded[1].data.affiliateLinks).toEqual([]);
  });
});
