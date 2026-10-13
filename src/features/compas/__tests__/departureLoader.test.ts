import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * D'où part le trajet d'approche, tel que le chargeur de l'écran le rend (PLAN-100 4.3) : le départ DIT,
 * le domicile du profil voyageur, la position de l'appareil, sinon aucun. Seul le départ dit a un nom ;
 * le nom et les coordonnées du domicile ne sortent jamais du chargeur (verrou de vie privée du profil
 * voyageur), et le domicile ou la position d'une personne ne sont pas montrés à une autre.
 *
 * Frontières simulées : le hub, la base en mémoire (profil voyageur compris), la météo, les alertes, le relief.
 */
const h = vi.hoisted(() => ({
  trip: null as Record<string, unknown> | null,
  viewer: null as { id: string; is_anonymous?: boolean } | null,
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/features/hub/server/getHubAdventureData', () => ({
  getHubAdventureData: vi.fn(async () => ({
    trip: h.trip,
    group: null,
    hiking: null,
    affiliateLinks: [],
  })),
}));
vi.mock('@/lib/supabase/server', async () => {
  const { memorySupabase } = await import('./helpers/memorySupabase');
  return {
    createClient: async () => {
      const db = memorySupabase({ user: () => h.viewer });
      db.rows('user_traveller').push(...h.rows);
      return db.client;
    },
  };
});
vi.mock('@/features/booking/server/providerCredentials', () => ({
  getActiveProviderMode: () => ({ routestack: 'disabled', viator: 'disabled' }),
}));
vi.mock('../server/officialAlerts', () => ({
  getOfficialAlerts: vi.fn(async () => ({ status: 'hors_france', alerts: [], area: null })),
}));
vi.mock('../server/elevation', () => ({
  getRouteElevation: vi.fn(async () => null),
  pointsMaxAltitudeM: vi.fn(async () => null),
  pointsAltitudeRange: vi.fn(async () => null),
}));
vi.mock('../server/rates', () => ({
  getEurRate: vi.fn(async () => null),
  getBudgetFx: vi.fn(async () => null),
}));
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
  getCompasWeather: vi.fn(async () => null),
}));

import { getCompasData } from '../server/getCompasData';

/** Un domicile au nom et aux coordonnées reconnaissables : s'ils sortent du chargeur, un test le voit. */
const HOME = { home_name: 'Villeurbanne', home_lat: 45.77, home_lon: 4.88, home_country: 'FR' };
const profile = (userId: string, over: Record<string, unknown> = {}) => ({
  user_id: userId,
  nationality: null,
  residence_country: null,
  currency: null,
  language: null,
  time_zone: null,
  home_name: null,
  home_lat: null,
  home_lon: null,
  home_country: null,
  ...over,
});

const tripWith = (compas: Record<string, unknown> | null) => ({
  id: 'trip-1',
  slug: 'islande',
  title: 'Islande',
  user_id: 'u1',
  destination_name: 'Reykjavik',
  destination_country_code: 'IS',
  start_date: '2027-02-10',
  end_date: '2027-02-12',
  primary_activity: 'hiking',
  party_size: 2,
  budget_currency: 'EUR',
  estimated_budget: null,
  metadata: compas ? { compas } : null,
  steps: [],
  items: [],
  expenses: [],
  pois: [],
  collaborators: [],
  member_profiles: [],
  permissions: { canEdit: true },
});

const SAID = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' };
/** Une préparation faite : la source de son départ et qui l'a lancée (`autofill.papers`). */
const prepared = (abroadFrom: string | null, launchedBy?: string) => ({
  autofill: {
    runId: 'run-1',
    papers: {
      countryCode: 'IS',
      country: 'Islande',
      abroad: true,
      ...(abroadFrom ? { abroadFrom } : {}),
      ...(launchedBy ? { launchedBy } : {}),
    },
  },
});

const departureAs = async (viewer: { id: string; is_anonymous?: boolean } | null) => {
  h.viewer = viewer;
  return (await getCompasData())?.departure;
};

beforeEach(() => {
  h.viewer = { id: 'u1' };
  h.rows = [];
  h.trip = tripWith(null);
});

describe('départ dit', () => {
  it('seul à porter un nom : le lieu dit, quoi qu’il y ait ailleurs', async () => {
    h.trip = tripWith({ origin: SAID, ...prepared('gps', 'u1') });
    h.rows = [profile('u1', HOME)];
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'dit', name: 'Lyon' });
  });

  it('un fait du voyage : le même pour un collaborateur, un anonyme et un lecteur public', async () => {
    h.trip = tripWith({ origin: SAID, ...prepared('domicile', 'u1') });
    for (const viewer of [{ id: 'u2' }, { id: 'anon', is_anonymous: true }, null])
      expect(await departureAs(viewer), JSON.stringify(viewer)).toEqual({
        source: 'dit',
        name: 'Lyon',
      });
  });

  it('effacé : retour au domicile du profil, sinon à la position de la préparation, sinon aucun', async () => {
    h.rows = [profile('u1', HOME)];
    h.trip = tripWith({});
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'domicile' });
    h.rows = [profile('u1')];
    h.trip = tripWith({ ...prepared('gps', 'u1') });
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'gps' });
    h.trip = tripWith({});
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'aucun' });
  });

  it('une préparation faite depuis le départ dit puis effacé : le trace « dit » ne vaut plus, retour au domicile', async () => {
    h.rows = [profile('u1', HOME)];
    h.trip = tripWith({ ...prepared('dit') });
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'domicile' });
    h.rows = [];
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'aucun' });
  });
});

describe('domicile du profil : « depuis ton domicile », jamais son nom', () => {
  it('sans départ dit ni préparation : le prochain trajet partira du domicile', async () => {
    h.rows = [profile('u1', HOME)];
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'domicile' });
  });

  it('préparation partie du domicile par cette personne : domicile', async () => {
    h.rows = [profile('u1', HOME)];
    h.trip = tripWith({ ...prepared('domicile', 'u1') });
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'domicile' });
  });

  it('ni le nom ni les coordonnées du domicile ne sortent du chargeur, pour personne', async () => {
    h.rows = [
      profile('u1', HOME),
      profile('u2', { ...HOME, home_name: 'Chambéry', home_lat: 45.57, home_lon: 5.92 }),
    ];
    h.trip = tripWith({ ...prepared('domicile', 'u1') });
    for (const viewer of [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }, null]) {
      h.viewer = viewer;
      const out = JSON.stringify(await getCompasData());
      for (const leak of ['Villeurbanne', 'Chambéry', '45.77', '4.88', '45.57', '5.92', 'home_'])
        expect(out, `${JSON.stringify(viewer)} : ${leak}`).not.toContain(leak);
    }
  });

  it('le domicile d’une personne n’est pas celui d’une autre : un collaborateur avec le sien ne lit pas celui du lanceur', async () => {
    h.rows = [profile('u1', HOME), profile('u2', { ...HOME, home_name: 'Chambéry' })];
    h.trip = tripWith({ ...prepared('domicile', 'u1') });
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'domicile' });
    expect(await departureAs({ id: 'u2' })).toEqual({ source: 'autre' });
    expect(await departureAs({ id: 'u9' })).toEqual({ source: 'autre' });
    expect(await departureAs(null)).toEqual({ source: 'autre' });
  });

  it('essai sans compte : le profil n’est pas lu, aucun domicile', async () => {
    h.rows = [profile('anon', HOME)];
    expect(await departureAs({ id: 'anon', is_anonymous: true })).toEqual({ source: 'aucun' });
  });
});

describe('position de l’appareil : « depuis ta position », arrondie, sans nom', () => {
  it('préparation partie de la position par cette personne : position, pour elle seule', async () => {
    h.trip = tripWith({ ...prepared('gps', 'u1') });
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'gps' });
    expect(await departureAs({ id: 'u2' })).toEqual({ source: 'autre' });
    expect(await departureAs(null)).toEqual({ source: 'autre' });
  });

  it('préparation d’avant la source rangée : rien d’affirmé, domicile du profil ou aucun', async () => {
    h.trip = tripWith({ ...prepared(null) });
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'aucun' });
    h.rows = [profile('u1', HOME)];
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'domicile' });
  });
});

describe('aucun point de départ', () => {
  it('ni départ dit, ni domicile, ni préparation : aucun (le trajet n’est pas chiffré)', async () => {
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'aucun' });
    expect(await departureAs(null)).toEqual({ source: 'aucun' });
  });

  it('préparation annulée : sa trace ne compte plus', async () => {
    h.trip = tripWith({ autofill: { ...prepared('gps', 'u1').autofill, runId: null } });
    expect(await departureAs({ id: 'u1' })).toEqual({ source: 'aucun' });
  });
});
