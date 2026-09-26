import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getServiceSupabase: vi.fn(),
  createTrip: vi.fn(),
  runAutoGenPipeline: vi.fn(),
  createTripFromAutogenIntent: vi.fn(),
  enqueueActivityEnrichment: vi.fn(),
  generateTripDocuments: vi.fn(),
  generateJournalNotes: vi.fn(),
  createKitForTrip: vi.fn(),
  awardTrailPrepared: vi.fn(),
  claimTripLaunch: vi.fn(),
  completeTripLaunch: vi.fn(),
  failTripLaunch: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: mocks.getServiceSupabase }));
vi.mock('@/lib/queries-trips', () => ({ createTrip: mocks.createTrip }));
vi.mock('@/features/trips/engine/autoGenPipeline', () => ({
  runAutoGenPipeline: mocks.runAutoGenPipeline,
}));
vi.mock('@/features/trips/server/createTripFromAutogenIntent', () => ({
  createTripFromAutogenIntent: mocks.createTripFromAutogenIntent,
}));
vi.mock('@/features/trips/server/activityEnrichment/enqueue', () => ({
  enqueueActivityEnrichment: mocks.enqueueActivityEnrichment,
}));
vi.mock('@/features/trips/server/generateTripDocuments', () => ({
  generateTripDocuments: mocks.generateTripDocuments,
}));
vi.mock('@/features/trips/server/generateJournalNotes', () => ({
  generateJournalNotes: mocks.generateJournalNotes,
}));
vi.mock('@/features/trips/server/createKitForTrip', () => ({
  createKitForTrip: mocks.createKitForTrip,
}));
vi.mock('@/features/progression/server/producerHooks', () => ({
  awardTrailPrepared: mocks.awardTrailPrepared,
}));
vi.mock('@/features/trips/server/tripLaunch', () => ({
  claimTripLaunch: mocks.claimTripLaunch,
  completeTripLaunch: mocks.completeTripLaunch,
  failTripLaunch: mocks.failTripLaunch,
}));

import { prepareActivityFromTrail } from '@/features/trips/server/prepareActivityFromTrail';

const USER = '11111111-1111-4111-8111-111111111111';
const ROUTE = 4242;
const MY_TRIP = 'trip-mine';
const WINNER_TRIP = 'trip-winner';

const GEOMETRY = {
  type: 'LineString',
  coordinates: [
    [6.1, 45.1],
    [6.2, 45.2],
    [6.3, 45.3],
  ],
};

type TripsQuery = { kind: 'none' | 'row'; row?: Record<string, unknown> };

/**
 * Client Supabase minimal : `trips` sert au findExistingTrip, le reste n'est
 * jamais atteint sur les chemins testes.
 */
function fakeDb(trips: TripsQuery) {
  const maybeSingle = vi.fn(async () => ({
    data:
      trips.kind === 'row' && trips.row
        ? trips.row
        : trips.kind === 'row'
          ? null
          : null,
    error: null,
  }));
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: USER } } })) },
    rpc: vi.fn(async (name: string) => {
      if (name === 'get_route_geojson') return { data: GEOMETRY, error: null };
      if (name === 'get_trail_pois_bbox') return { data: [], error: null };
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      if (table === 'hiking_routes') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: ROUTE, name: 'Sentier des Cretes', ref: 'CR1', network: 'PNR', distance_km: 12.5 }, error: null })) })),
          })),
        };
      }
      if (table === 'trail_metadata') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { difficulty: 'moyen', duration_hours: 4, elevation_gain: 500, terrain_type: 'roche' },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === 'trips') {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          filter: vi.fn(() => chain),
          limit: vi.fn(() => chain),
          maybeSingle,
          update: vi.fn(() => chain),
          delete: vi.fn(() => chain),
        };
        return chain;
      }
      return { select: vi.fn(() => chain0()), insert: vi.fn(() => chain0()) };
      function chain0() {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle']) {
          c[m] = vi.fn(() => c);
        }
        return c;
      }
    }),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  mocks.getServiceSupabase.mockReturnValue(null);
  mocks.runAutoGenPipeline.mockResolvedValue({
    layers: { steps: [], pois: [], expenses: [] },
    brief: { title: 'Rando', partySize: 2 },
  });
  mocks.createTripFromAutogenIntent.mockResolvedValue({
    ok: true,
    tripId: MY_TRIP,
    slug: 'rando-cretes',
    title: 'Rando des Cretes',
    partial: false,
    warnings: [],
  });
  mocks.generateTripDocuments.mockResolvedValue({ warnings: [] });
  mocks.generateJournalNotes.mockResolvedValue({ ok: true });
  mocks.createKitForTrip.mockResolvedValue({ kitId: 'kit-1' });
  mocks.enqueueActivityEnrichment.mockResolvedValue(undefined);
  mocks.awardTrailPrepared.mockResolvedValue(undefined);
  mocks.completeTripLaunch.mockResolvedValue({
    status: 'ready',
    trip: { tripId: MY_TRIP, slug: 'rando-cretes', title: 'Rando des Cretes' },
  });
  mocks.failTripLaunch.mockResolvedValue('failed');
});

describe('prepareActivityFromTrail — reservation atomique', () => {
  it('claim ready : reutilise sans jamais creer de voyage', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ kind: 'none' }));
    mocks.claimTripLaunch.mockResolvedValue({
      status: 'ready',
      trip: { tripId: WINNER_TRIP, slug: 'gagnante', title: 'Activite gagnante' },
    });

    const outcome = await prepareActivityFromTrail(String(ROUTE));

    expect(outcome).toEqual({
      status: 'reused',
      tripId: WINNER_TRIP,
      slug: 'gagnante',
      title: 'Activite gagnante',
    });
    expect(mocks.createTripFromAutogenIntent).not.toHaveBeenCalled();
    expect(mocks.createTrip).not.toHaveBeenCalled();
    expect(mocks.completeTripLaunch).not.toHaveBeenCalled();
  });

  it('claim claimed + completion lost : compense l orphelin et sert la gagnante', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ kind: 'none' }));
    mocks.claimTripLaunch.mockResolvedValue({ status: 'claimed' });
    mocks.completeTripLaunch.mockResolvedValue({
      status: 'lost',
      trip: { tripId: WINNER_TRIP, slug: 'gagnante', title: 'Activite gagnante' },
    });

    const outcome = await prepareActivityFromTrail(String(ROUTE));

    expect(mocks.completeTripLaunch).toHaveBeenCalledWith(expect.anything(), USER, ROUTE, MY_TRIP);
    expect(mocks.failTripLaunch).toHaveBeenCalledWith(
      expect.anything(),
      USER,
      ROUTE,
      MY_TRIP,
      'lost_race'
    );
    expect(outcome).toEqual({
      status: 'reused',
      tripId: WINNER_TRIP,
      slug: 'gagnante',
      title: 'Activite gagnante',
    });
  });

  it('claim claimed + completion unavailable : compense puis repli explicite', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ kind: 'none' }));
    mocks.claimTripLaunch.mockResolvedValue({ status: 'claimed' });
    mocks.completeTripLaunch.mockResolvedValue({ status: 'unavailable' });

    const outcome = await prepareActivityFromTrail(String(ROUTE));

    expect(mocks.failTripLaunch).toHaveBeenCalledWith(
      expect.anything(),
      USER,
      ROUTE,
      MY_TRIP,
      'complete_unavailable'
    );
    // Aucun voyage gagnant cote base -> statut d echec explicite, jamais un etat partiel.
    expect(outcome).toEqual({ status: 'unavailable', reason: 'persist_failed' });
  });

  it('claim claimed + completion ready : aucune compensation, creation servie', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ kind: 'none' }));
    mocks.claimTripLaunch.mockResolvedValue({ status: 'claimed' });

    const outcome = await prepareActivityFromTrail(String(ROUTE));

    expect(mocks.failTripLaunch).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      status: 'created',
      tripId: MY_TRIP,
      slug: 'rando-cretes',
      title: 'Rando des Cretes',
    });
  });

  it('claim in_progress : attend la gagnante, ne cree aucun voyage', async () => {
    mocks.createClient.mockResolvedValue(fakeDb({ kind: 'none' }));
    mocks.claimTripLaunch.mockResolvedValue({ status: 'in_progress' });

    // findExistingTrip ne voit rien au premier appel : la boucle attend, puis
    // on force la victoire en marquant la reservation indisponible.
    mocks.claimTripLaunch.mockResolvedValue({ status: 'in_progress' });
    const outcome = await prepareActivityFromTrail(String(ROUTE));

    expect(mocks.createTripFromAutogenIntent).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'unavailable', reason: 'persist_failed' });
  }, 20000);
});

