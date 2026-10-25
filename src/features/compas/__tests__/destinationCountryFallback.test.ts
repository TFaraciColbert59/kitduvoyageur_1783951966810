import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Pays de la destination quand la colonne `trips.destination_country_code` est vide : un pays absent de
 * la table des pays (la Tchéquie avant la migration du 14 oct., « 4 jours à Prague » du 13 oct.) laisse la
 * colonne à NULL, le pays n'est gardé que dans l'ancre du voyage (`metadata.compas.anchor.countryCode`).
 * `getCompasData` relit alors le pays de l'ancre, pour tout ce qui en dépend : le lien vers la page du pays,
 * la devise de la destination et les liens partenaires du pays (sinon seuls les liens sans pays restent).
 * Rien ici ne dépend du profil du lecteur.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  viewer: null as { id: string; is_anonymous?: boolean } | null,
  links: [] as Array<Record<string, unknown>>,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../server/stagePoiLookup', () => ({
  lookupAreaPlaces: vi.fn(async () => null),
  lookupRiverLine: vi.fn(async () => null),
  lookupStagePois: vi.fn(async () => null),
}));
vi.mock('@/lib/geo/terrainElevation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geo/terrainElevation')>()),
  terrainElevations: vi.fn((points: unknown[]) => Promise.resolve(points.map(() => null))),
}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/elevation', () => ({
  routeAscentM: vi.fn(async () => null),
  pointsMaxAltitudeM: vi.fn(async () => null),
  pointsAltitudeRange: vi.fn(async () => null),
  getRouteElevation: vi.fn(async () => null),
}));
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
  getCompasWeather: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({ aiEnabled: () => false, askAI: vi.fn(async () => ({ text: '{}', degraded: true })) }));
vi.mock('@/features/hub/server/getHubAdventureData', () => ({
  getHubAdventureData: vi.fn(async () => ({
    trip: {
      ...h.db.rows('trips')[0],
      steps: [],
      items: [],
      expenses: [],
      pois: [],
      collaborators: [],
      member_profiles: [],
      permissions: { canEdit: true },
    },
    group: null,
    hiking: null,
    affiliateLinks: h.links,
  })),
}));
vi.mock('@/features/booking/server/providerCredentials', () => ({
  getActiveProviderMode: () => ({ routestack: 'disabled', viator: 'disabled' }),
}));
vi.mock('../server/officialAlerts', () => ({
  getOfficialAlerts: vi.fn(async () => ({ status: 'hors_france', alerts: [], area: null })),
}));
vi.mock('../server/rates', () => ({
  getEurRate: vi.fn(async () => null),
  getBudgetFx: vi.fn(async () => null),
}));

import { getCompasData } from '../server/getCompasData';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '66666666-6666-4666-8666-666666666666';

function trip(column: string | null, anchorCountry: unknown) {
  h.db.rows('trips').push({
    id: TRIP,
    slug: 'voyage',
    user_id: 'u1',
    title: 'Séjour · Prague',
    start_date: '2026-11-10',
    end_date: '2026-11-13',
    destination_name: 'Prague',
    destination_country_code: column,
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'citytrip',
    estimated_budget: null,
    visibility: 'public',
    metadata: { compas: { anchor: { name: 'Prague', lat: 50.09, lon: 14.42, countryCode: anchorCountry, country: 'Tchéquie', kind: 'city' } } },
    updated_at: '2026-10-13T09:00:00.000000+00:00',
  });
}
const link = (id: string, countryCode: string | null) => ({
  id,
  slug: `lien-${id}`,
  title: `Lien ${id}`,
  category: 'activite',
  country_code: countryCode,
  destination_name: null,
  partner: { name: 'Partenaire' },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.viewer = { id: 'u1' };
  h.links = [link('cz', 'CZ'), link('fr', 'FR'), link('monde', null)];
  h.db = memorySupabase({ user: () => h.viewer });
});

describe('colonne du pays vide, pays gardé dans l’ancre (Prague, 13 oct.)', () => {
  it('le lien vers la page du pays et les liens partenaires du pays sont ceux de l’ancre', async () => {
    trip(null, 'CZ');
    const data = await getCompasData();
    expect(data?.countryCode).toBe('cz');
    // Le lien du pays et le lien générique ; pas celui d'un autre pays.
    expect(data?.affiliateLinks.map((l) => l.id).sort()).toEqual(['cz', 'monde']);
  });

  it('la colonne renseignée prime sur l’ancre', async () => {
    trip('FR', 'CZ');
    const data = await getCompasData();
    expect(data?.countryCode).toBe('fr');
    expect(data?.affiliateLinks.map((l) => l.id).sort()).toEqual(['fr', 'monde']);
  });

  it('ni colonne ni code valide dans l’ancre : aucun pays, seuls les liens génériques', async () => {
    trip(null, 'Tchéquie');
    const data = await getCompasData();
    expect(data?.countryCode).toBeNull();
    expect(data?.affiliateLinks.map((l) => l.id)).toEqual(['monde']);
  });
});
