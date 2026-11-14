import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Aperçu du 14/11 — source muette, côté recherche des lieux d'une zone (`lookupAreaPlaces`) : « la carte a répondu
 * et n'a qu'un lieu » ne se lisait pas de « la carte n'a pas répondu » dans la liste rendue. Le statut rempli par
 * la recherche les distingue, et un résultat maigre rendu faute de réponse n'est pas gardé un mois en cache.
 * Réseau simulé (Photon, Overpass, Geoapify) : aucun appel réel.
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
const overpassPost = vi.fn(async (..._args: unknown[]) => new Response('{}', { status: 504 }));
vi.mock('@/lib/overpass', () => ({
  OVERPASS_ENDPOINTS: ['https://overpass.private.coffee/api/interpreter'],
  overpassPost: (...args: unknown[]) => overpassPost(...args),
  serializeOverpass: (fn: () => Promise<unknown>) => fn(),
}));

import { lookupAreaPlaces, type AreaSourceStatus } from '../server/stagePoiLookup';
import { cached } from '../server/sharedCache';

const villages = (names: string[]) => ({
  features: names.map((name, i) => ({
    geometry: { coordinates: [19.88 + i / 20, 49.26] },
    properties: { name, osm_key: 'place', osm_value: 'village', osm_id: i + 1, osm_type: 'N', countrycode: 'pl' },
  })),
});
let photon: unknown = villages(['Kościelisko']);
const fetchMock = vi.fn(async (...args: unknown[]) =>
  String(args[0]).includes('photon')
    ? new Response(JSON.stringify(photon), { status: 200 })
    : new Response(JSON.stringify({ features: [] }), { status: 200 })
);
const ZONE = { center: { lat: 49.2, lon: 19.95 }, radiusKm: 30, activity: 'hiking' } as const;
const later = () => Date.now() + 60_000;
/** Le critère de garde du cache (5e argument de `cached`) de la dernière recherche, appliqué au résultat. */
const wouldKeep = (value: unknown) => (vi.mocked(cached).mock.calls.at(-1)?.[4] as (v: unknown) => boolean)(value);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GEOAPIFY_API_KEY', '');
  photon = villages(['Kościelisko']);
  overpassPost.mockImplementation(async () => new Response('{}', { status: 504 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('Aperçu du 14/11 — source muette : l’état de la recherche des lieux', () => {
  it('Overpass muet et un seul lieu rendu : « muet », et rien n’est gardé en cache', async () => {
    const status: AreaSourceStatus = { silent: false };
    const found = await lookupAreaPlaces(ZONE, later(), [], status);
    expect(found?.map((p) => p.name)).toEqual(['Kościelisko']);
    expect(status.silent).toBe(true);
    expect(wouldKeep(found)).toBe(false);
  });

  it('Overpass répond avec un seul lieu : la zone est pauvre, pas muette ; une zone maigre n’est plus gardée', async () => {
    overpassPost.mockImplementation(
      async () => new Response(JSON.stringify({ elements: [{ type: 'node', id: 7, lat: 49.26, lon: 19.88, tags: { place: 'village', name: 'Kościelisko' } }] }), { status: 200 })
    );
    const status: AreaSourceStatus = { silent: false };
    const found = await lookupAreaPlaces(ZONE, later(), [], status);
    expect(found?.map((p) => p.name)).toEqual(['Kościelisko']);
    expect(status.silent).toBe(false);
    // Aperçu du 14/11 : gardée un mois, cette zone à un lieu a servi des itinéraires vides.
    expect(wouldKeep(found)).toBe(false);
  });

  it('Overpass répond sans aucun lieu : zone vide, pas muette', async () => {
    overpassPost.mockImplementation(async () => new Response(JSON.stringify({ elements: [] }), { status: 200 }));
    const status: AreaSourceStatus = { silent: false };
    await lookupAreaPlaces(ZONE, later(), [], status);
    expect(status.silent).toBe(false);
  });

  it('Photon suffit (trois lieux ou plus) : Overpass n’est pas demandé, la zone n’est pas muette', async () => {
    photon = villages(['Kościelisko', 'Witów', 'Dzianisz', 'Poronin']);
    const status: AreaSourceStatus = { silent: false };
    const found = await lookupAreaPlaces(ZONE, later(), [], status);
    expect(found).toHaveLength(4);
    expect(status.silent).toBe(false);
    expect(overpassPost).not.toHaveBeenCalled();
    expect(wouldKeep(found)).toBe(true);
  });

  it('tout est muet : aucun lieu, « muet » (jamais pris pour une zone vide)', async () => {
    photon = { features: [] };
    const status: AreaSourceStatus = { silent: false };
    const found = await lookupAreaPlaces(ZONE, later(), [], status);
    expect(found).toBeNull();
    expect(status.silent).toBe(true);
  });

  it('sans statut demandé : la recherche rend la même liste (signature d’avant)', async () => {
    const found = await lookupAreaPlaces(ZONE, later());
    expect(found?.map((p) => p.name)).toEqual(['Kościelisko']);
    expect(wouldKeep(found)).toBe(false);
  });
});

describe('Aperçu du 14/11 — zone maigre jamais servie du cache', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  /** Le filtre de lecture du cache (6e argument de `cached`) de la dernière recherche. */
  const wouldServe = (hit: unknown) => (vi.mocked(cached).mock.calls.at(-1)?.[5] as (v: unknown) => boolean)(hit);
  const place = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Lieu ${i}` }));

  it('une zone de moins de trois lieux n’est ni gardée ni relue du cache, même si la carte a répondu', async () => {
    await lookupAreaPlaces(ZONE, later());
    expect(wouldKeep(place(1))).toBe(false);
    expect(wouldKeep(place(2))).toBe(false);
    expect(wouldServe(place(1))).toBe(false);
    expect(wouldServe(place(2))).toBe(false);
  });

  it('une zone de trois lieux ou plus reste partagée et servie', async () => {
    photon = villages(['Kościelisko', 'Zakopane', 'Poronin']);
    await lookupAreaPlaces(ZONE, later());
    photon = villages(['Kościelisko']);
    expect(wouldKeep(place(3))).toBe(true);
    expect(wouldServe(place(12))).toBe(true);
  });
});
