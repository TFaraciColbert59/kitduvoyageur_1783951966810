import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Descente en canoë, de bout en bout sur `compasAutofillAction` : sur l'eau, la rivière du référentiel
 * `geo_rivers` (plan 3.6) est demandée AVANT la carte ; trouvée, son emprise devient celle du point
 * d'ancrage et c'est elle que reçoit le tracé (`lookupRiverLine`). Rien au référentiel : le chemin
 * d'avant (lieu naturel, puis rivière sous son article), sans second appel au référentiel.
 * Frontières simulées : base en mémoire, recherche de lieux, tracé.
 */
const h = vi.hoisted(() => ({ db: null as unknown as MemorySupabase }));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({
  reportServerError: vi.fn(async () => undefined),
}));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
  lookupNatural: vi.fn(async () => null),
  lookupMassif: vi.fn(async () => null),
  lookupReverse: vi.fn(async () => null),
  lookupRiver: vi.fn(async () => null),
  stageCandidates: vi.fn(async () => []),
  stageAliasCandidates: vi.fn(async () => []),
}));
vi.mock('../server/stagePoiLookup', () => ({
  lookupAreaPlaces: vi.fn(async () => null),
  lookupRiverLine: vi.fn(async () => null),
  lookupStagePois: vi.fn(async () => null),
}));
vi.mock('@/lib/geo/terrainElevation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geo/terrainElevation')>()),
  terrainElevations: vi.fn((points: unknown[]) => Promise.resolve(points.map(() => null))),
}));
vi.mock('@/features/adventure-prep/routingService', async (orig) => ({
  ...(await orig<typeof import('@/features/adventure-prep/routingService')>()),
  routeAttempt: vi.fn(async () => ({ legs: null, reason: 'provider_unavailable' })),
}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) =>
    fn()
  ),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/elevation', () => ({
  routeAscentM: vi.fn(async () => null),
  pointsMaxAltitudeM: vi.fn(async () => null),
}));
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => false,
  askAI: vi.fn(async () => ({
    text: '{}',
    model: 'x',
    degraded: true,
    cached: false,
    provider: 'fallback',
  })),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { lookupNatural, lookupRiver } from '../server/placeLookup';
import { lookupRiverLine } from '../server/stagePoiLookup';
import type { CompasPlace } from '../engine/places';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '66666666-6666-4666-8666-666666666666';
const launch = () =>
  compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });
const TARN: CompasPlace = {
  name: 'Tarn',
  lat: 44.1,
  lon: 2.4,
  countryCode: null,
  country: null,
  kind: 'river',
  landmark: true,
  osmTag: 'waterway=river',
  extent: [1.05, 44.42, 3.85, 43.98],
};
const anchorRow = () =>
  (h.db.rows('trips')[0].metadata as { compas: { anchor: Record<string, unknown> } }).compas.anchor;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lookupRiver).mockImplementation(async () => null);
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
  // « 3 jours de canoë sur le Tarn » : la carte avait lu un bois près de Saint-Sulpice (8 oct.).
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Canoë · Tarn',
    start_date: '2026-07-10',
    end_date: '2026-07-12',
    destination_name: 'Tarn',
    destination_country_code: 'FR',
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'water',
    estimated_budget: null,
    metadata: {
      compas: {
        anchor: {
          name: 'Tarn',
          lat: 43.78,
          lon: 1.69,
          countryCode: 'FR',
          country: 'France',
          kind: 'wood',
        },
      },
    },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
});

describe('canoë : la rivière du référentiel avant la carte', () => {
  it('trouvée : emprise de la rivière sur le point d’ancrage, passée au tracé, sans lieu naturel cherché', async () => {
    vi.mocked(lookupRiver).mockImplementation(async (_n, _c, opts) =>
      opts?.referential === 'only' ? TARN : null
    );
    expect((await launch()).success).toBe(true);
    expect(lookupRiver).toHaveBeenCalledTimes(1);
    expect(lookupRiver).toHaveBeenCalledWith('Tarn', 'FR', {
      near: { lat: 43.78, lon: 1.69 },
      referential: 'only',
    });
    expect(lookupNatural).not.toHaveBeenCalled();
    expect(lookupRiverLine).toHaveBeenCalledWith(
      'Tarn',
      [1.05, 44.42, 3.85, 43.98],
      expect.any(Number)
    );
    const a = anchorRow();
    expect(a.kind).toBe('river');
    expect(a.extent).toEqual([1.05, 44.42, 3.85, 43.98]);
    expect(a.countryCode).toBe('FR');
  });

  it('absente : lieu naturel puis rivière sous son article, comme avant, le référentiel sauté', async () => {
    expect((await launch()).success).toBe(true);
    expect(lookupNatural).toHaveBeenCalledWith('Tarn', 'FR', true);
    expect(lookupRiver).toHaveBeenCalledTimes(2);
    expect(vi.mocked(lookupRiver).mock.calls[1]).toEqual(['Tarn', 'FR', { referential: 'skip' }]);
    expect(lookupRiverLine).not.toHaveBeenCalled();
  });
});
