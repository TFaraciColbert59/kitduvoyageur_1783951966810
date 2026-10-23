import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lieux d'une zone et référentiel dans la langue de l'interface (PLAN-100 6.4, suite de
 * `placeLookupLanguage.test.ts`) : Photon (`lang`), Overpass (`name:<langue>`), Geoapify Places
 * (`lang`), noms de pays du référentiel (`Intl`), clés de cache par langue. En français, adresses,
 * clés et noms IDENTIQUES à ceux d'avant. Réseau simulé : aucun appel réel.
 */
vi.mock('server-only', () => ({}));
vi.mock('@/lib/i18n/serverLocale', () => ({ getRequestLocale: vi.fn(async () => 'fr') }));
vi.mock('@/lib/siteSlot', () => ({ photonSlot: vi.fn(async () => true) }));
vi.mock('@/lib/apiCredits', () => ({ GEOAPIFY_DAILY_CREDITS: 2700, takeApiCredits: vi.fn(async () => true) }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => null }));
vi.mock('../server/sharedCache', () => ({
  readShared: async () => undefined,
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  coordKey: (lat: number, lon: number) => `${lat},${lon}`,
}));
const overpassPost = vi.fn(async (..._args: unknown[]) => new Response('{}', { status: 503 }));
vi.mock('@/lib/overpass', () => ({
  OVERPASS_ENDPOINTS: ['https://overpass.private.coffee/api/interpreter'],
  overpassPost: (...args: unknown[]) => overpassPost(...args),
  serializeOverpass: (fn: () => Promise<unknown>) => fn(),
}));

import { lookupAreaPlaces } from '../server/stagePoiLookup';
import { cached } from '../server/sharedCache';
import { getRequestLocale } from '@/lib/i18n/serverLocale';
import { parseAreaPlaces } from '../engine/itinerary';
import { referentialPlaceToCompas } from '../engine/geoPlaceSearch';

const photonVillages = {
  features: ['Vienne', 'Lyon', 'Givors', 'Condrieu'].map((name, i) => ({
    geometry: { coordinates: [4.8 + i / 100, 45.5] },
    properties: { name, osm_key: 'place', osm_value: 'village', osm_id: i + 1, osm_type: 'N', countrycode: 'fr' },
  })),
};
const fetchMock = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(photonVillages), { status: 200 }));
const urls = () => fetchMock.mock.calls.map((c) => String(c[0]));
const keys = () => vi.mocked(cached).mock.calls.map((c) => `${c[0]}|${c[1]}`);
const ZONE = { center: { lat: 45.5, lon: 4.85 }, radiusKm: 10, activity: 'rando' } as const;
const later = () => Date.now() + 60_000;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GEOAPIFY_API_KEY', 'cle-test');
  vi.mocked(getRequestLocale).mockResolvedValue('fr');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('lieux d’une zone (itinéraire) : Photon dans la langue de l’interface', () => {
  it('français : Photon en lang=fr et clé area:v3 d’avant, à l’identique', async () => {
    const found = await lookupAreaPlaces(ZONE, later());
    expect(found?.map((p) => p.name)).toEqual(['Vienne', 'Lyon', 'Givors', 'Condrieu']);
    expect(urls().every((u) => u.startsWith('https://photon.komoot.io/api/?limit=50&lang=fr&include='))).toBe(true);
    expect(keys()).toHaveLength(1);
    expect(keys()[0]).toMatch(/^place\|area:v3:[0-9a-f]{32}$/);
  });

  it('anglais : Photon en lang=en, clé distincte (la même zone, préfixée par la langue)', async () => {
    await lookupAreaPlaces(ZONE, later());
    const frKey = keys()[0];
    vi.mocked(cached).mockClear();
    fetchMock.mockClear();
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    await lookupAreaPlaces(ZONE, later());
    expect(urls().every((u) => u.includes('&lang=en&'))).toBe(true);
    expect(keys()).toEqual([`place|en:${frKey.slice('place|'.length)}`]);
  });

  it('Photon maigre : Geoapify Places reçoit la langue (fr d’avant, en sinon)', async () => {
    fetchMock.mockImplementation(async (...args: unknown[]) =>
      String(args[0]).includes('geoapify')
        ? new Response(JSON.stringify({ features: [] }), { status: 200 })
        : new Response(JSON.stringify({ features: [] }), { status: 200 })
    );
    await lookupAreaPlaces(ZONE, later());
    const geo = urls().find((u) => u.includes('api.geoapify.com/v2/places'))!;
    expect(new URL(geo).searchParams.get('lang')).toBe('fr');
    fetchMock.mockClear();
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    await lookupAreaPlaces(ZONE, later());
    const geoEn = urls().find((u) => u.includes('api.geoapify.com/v2/places'))!;
    expect(new URL(geoEn).searchParams.get('lang')).toBe('en');
  });

  it('Overpass : le nom dans la langue de l’interface, sinon le nom local (jamais un nom inventé)', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ features: [] }), { status: 200 }));
    const elements = [
      { type: 'node', id: 1, lat: 48.2, lon: 16.37, tags: { place: 'city', name: 'Wien', 'name:fr': 'Vienne', 'name:en': 'Vienna' } },
      { type: 'node', id: 2, lat: 48.3, lon: 16.4, tags: { place: 'town', name: 'Korneuburg', 'name:fr': 'Korneubourg' } },
    ];
    overpassPost.mockImplementation(async () => new Response(JSON.stringify({ elements }), { status: 200 }));
    vi.mocked(getRequestLocale).mockResolvedValue('en');
    const found = await lookupAreaPlaces(ZONE, later());
    expect(found?.map((p) => p.name)).toEqual(['Vienna', 'Korneuburg']);
  });
});

describe('parseAreaPlaces : quel nom OSM garder, selon la langue', () => {
  const payload = {
    elements: [
      { type: 'node', id: 1, lat: 48.2, lon: 16.37, tags: { place: 'city', name: 'Wien', 'name:fr': 'Vienne', 'name:en': 'Vienna' } },
      { type: 'node', id: 2, lat: 48.3, lon: 16.4, tags: { place: 'town', name: 'Wien-Land', 'name:en': 'Vienna Land' } },
      { type: 'node', id: 3, lat: 55.75, lon: 37.61, tags: { place: 'city', name: 'Москва', 'name:fr': 'Moscou' } },
      { type: 'node', id: 4, lat: 55.9, lon: 37.4, tags: { place: 'town', name: 'Химки' } },
      { type: 'node', id: 5, lat: 55.9, lon: 37.5, tags: { place: 'hamlet', name: 'Refuge', 'name:en': 'Refuge' } },
    ],
  };
  it('français (défaut) : name:fr, puis name:en, puis le nom local, comme avant', () => {
    expect(parseAreaPlaces(payload).map((p) => p.name)).toEqual(['Vienne', 'Vienna Land', 'Moscou', 'Химки']);
    expect(parseAreaPlaces(payload, 'fr')).toEqual(parseAreaPlaces(payload));
  });
  it('anglais : name:en, sinon le nom local (pas le nom français)', () => {
    expect(parseAreaPlaces(payload, 'en').map((p) => p.name)).toEqual(['Vienna', 'Vienna Land', 'Москва', 'Химки']);
  });
});

describe('référentiel geo_places : pays dans la langue de l’interface', () => {
  const row = { geoname_id: 2761369, name: 'Vienna', kind: 'city', country_code: 'AT', lat: 48.2, lon: 16.37, ele_m: null, population: 1_900_000 };
  it('français : « Autriche » et le nom GeoNames, comme avant', () => {
    expect(referentialPlaceToCompas(row)).toEqual(referentialPlaceToCompas(row, 'fr'));
    expect(referentialPlaceToCompas(row).country).toBe('Autriche');
    expect(referentialPlaceToCompas(row).name).toBe('Vienna');
  });
  it('anglais : « Austria » (nom CLDR, jamais traduit par nous)', () => {
    expect(referentialPlaceToCompas(row, 'en').country).toBe('Austria');
    expect(referentialPlaceToCompas(row, 'en').name).toBe('Vienna');
  });
});
