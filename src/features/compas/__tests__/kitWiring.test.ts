/**
 * Plan 4.8 : le chargeur de l'écran (`getCompasData`) lit les normales NASA POWER
 * du lieu et les donne aux conseils de kit, pour les jours sans prévision seulement.
 *
 * Frontières simulées : le hub, la base, MET Norway / NASA POWER (`./weather`),
 * les alertes, le relief, les taux de change. Les normales sont celles de la
 * vraie réponse de NASA POWER pour Reykjavik (`fixtures/power-climatology.json`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixtures from './fixtures/power-climatology.json';
import { powerClimateNormals } from '../engine/metno';
import { memorySupabase } from './helpers/memorySupabase';

const h = vi.hoisted(() => ({
  trip: null as Record<string, unknown> | null,
  forecastDays: [] as number[],
  normalsCalls: [] as Array<[number, number]>,
  normals: null as unknown,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/features/hub/server/getHubAdventureData', () => ({
  getHubAdventureData: vi.fn(async () => ({ trip: h.trip, group: null, hiking: null, affiliateLinks: [] })),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => memorySupabase({ user: () => ({ id: 'user-1' }) }).client,
}));
vi.mock('@/features/booking/server/providerCredentials', () => ({
  getActiveProviderMode: () => ({ routestack: 'disabled', viator: 'disabled' }),
}));
vi.mock('../server/officialAlerts', () => ({
  getOfficialAlerts: vi.fn(async () => ({ status: 'hors_france', alerts: [], area: null })),
}));
vi.mock('../server/elevation', () => ({ getRouteElevation: vi.fn(async () => null) }));
vi.mock('../server/rates', () => ({ getEurRate: vi.fn(async () => null) }));
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async (lat: number, lon: number) => {
    h.normalsCalls.push([lat, lon]);
    return h.normals;
  }),
  getCompasWeather: vi.fn(async (input: { tripDays: Array<{ day: number; date: string; lat: number; lon: number }> }) => ({
    source: 'MET Norway',
    trendSource: 'NASA POWER',
    horizon: '2027-02-19',
    calendar: [],
    tripDays: input.tripDays.map((d) => ({
      ...d,
      forecast: h.forecastDays.includes(d.day)
        ? {
            date: d.date,
            tMin: 2,
            tMax: 9,
            precipPct: 10,
            precipMm: 0,
            gustMax: 20,
            code: 1,
            sunrise: '09:30',
            sunset: '17:30',
            hours: [],
          }
        : null,
    })),
  })),
}));

import { getCompasData } from '../server/getCompasData';

const REYKJAVIK = { lat: fixtures.reykjavik.lat, lon: fixtures.reykjavik.lon };

const step = (day: number) => ({
  id: `step-${day}`,
  trip_id: 'trip-1',
  day_number: day,
  order_index: 0,
  title: `Jour ${day}`,
  location_name: 'Reykjavik',
  latitude: REYKJAVIK.lat,
  longitude: REYKJAVIK.lon,
  distance_km: 12,
  elevation_gain_m: 300,
  elevation_loss_m: 300,
  accommodation_name: null,
  transport_mode: 'foot',
  metadata: null,
});

const tripOf = (over: Record<string, unknown> = {}) => ({
  id: 'trip-1',
  slug: 'islande',
  title: 'Islande',
  user_id: 'user-1',
  destination_name: 'Reykjavik',
  destination_country_code: 'IS',
  start_date: '2027-02-10',
  end_date: '2027-02-12',
  primary_activity: 'hiking',
  party_size: 2,
  budget_currency: 'EUR',
  estimated_budget: null,
  metadata: null,
  steps: [step(1), step(2), step(3)],
  items: [],
  expenses: [],
  pois: [],
  collaborators: [],
  member_profiles: [],
  permissions: { canEdit: true },
  ...over,
});

describe('getCompasData donne les normales du lieu aux conseils de kit', () => {
  beforeEach(() => {
    h.trip = tripOf();
    h.forecastDays = [];
    h.normalsCalls = [];
    h.normals = powerClimateNormals(fixtures.reykjavik.payload);
  });

  it('au-delà de la prévision : normales du mois de chaque jour, lues au point du voyage, conseils cités NASA POWER', async () => {
    const data = await getCompasData();
    expect(h.normalsCalls).toEqual([[REYKJAVIK.lat, REYKJAVIK.lon]]);
    expect(data?.kitContext?.climate?.months.map((m) => m.month)).toEqual([2]);
    expect(data?.kitContext?.lat).toBe(REYKJAVIK.lat);
    const froid = data?.kitAdvice.find((a) => a.need === 'froid');
    expect(froid?.source).toMatch(/NASA POWER/);
    expect(froid?.reason).toContain('février');
    expect(data?.kitAdvice.map((a) => a.need)).toEqual(expect.arrayContaining(['pluie', 'extremites']));
  });

  it('jours couverts par la prévision : les normales ne parlent que des jours sans prévision', async () => {
    // Les jours 1 et 2 ont une prévision ; le jour 3 passe en mars (voyage à cheval sur deux mois).
    h.trip = tripOf({ start_date: '2027-02-27', end_date: '2027-03-01' });
    h.forecastDays = [1, 2];
    const data = await getCompasData();
    expect(data?.kitContext?.climate?.months.map((m) => m.month)).toEqual([3]);
  });

  it('prévision sur tous les jours : aucun climat dans le contexte, la prévision parle seule', async () => {
    h.forecastDays = [1, 2, 3];
    const data = await getCompasData();
    expect(data?.kitContext?.climate).toBeNull();
    expect(data?.kitAdvice.every((a) => !/NASA POWER/.test(a.source))).toBe(true);
  });

  it('service des normales muet : pas de climat, aucun conseil inventé', async () => {
    h.normals = null;
    const data = await getCompasData();
    expect(data?.kitContext?.climate).toBeNull();
    expect(data?.kitAdvice.map((a) => a.need)).not.toContain('froid');
  });

  it('sans date : les normales ne sont pas demandées', async () => {
    h.trip = tripOf({ start_date: null, end_date: null });
    const data = await getCompasData();
    expect(h.normalsCalls).toEqual([]);
    expect(data?.kitContext?.climate).toBeNull();
  });
});
