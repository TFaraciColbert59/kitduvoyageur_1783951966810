import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 14/11 — Overpass muet : les objectifs de journée d'un séjour sur une base (`lookupAreaObjectives`) se lisent
 * alors chez Geoapify Places (secours). Réseau simulé : aucun appel réel.
 */
vi.mock('server-only', () => ({}));
vi.mock('@/lib/i18n/serverLocale', () => ({ getRequestLocale: vi.fn(async () => 'fr') }));
vi.mock('@/lib/siteSlot', () => ({ photonSlot: vi.fn(async () => true) }));
const takeApiCredits = vi.fn(async (..._args: unknown[]) => true);
vi.mock('@/lib/apiCredits', () => ({
  GEOAPIFY_DAILY_CREDITS: 2700,
  takeApiCredits: (...args: unknown[]) => takeApiCredits(...args),
}));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => null }));
const writeShared = vi.fn(async (..._args: unknown[]) => undefined);
const readShared = vi.fn(async (..._args: unknown[]): Promise<unknown> => undefined);
vi.mock('../server/sharedCache', () => ({
  readShared: (...args: unknown[]) => readShared(...args),
  writeShared: (...args: unknown[]) => writeShared(...args),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  coordKey: (lat: number, lon: number) => `${lat},${lon}`,
}));
const overpassPost = vi.fn(async (..._args: unknown[]) => new Response('{}', { status: 504 }));
vi.mock('@/lib/overpass', () => ({
  OVERPASS_ENDPOINTS: ['https://overpass.private.coffee/api/interpreter'],
  overpassPost: (...args: unknown[]) => overpassPost(...args),
  serializeOverpass: (fn: () => Promise<unknown>) => fn(),
}));

import { lookupAreaObjectives } from '../server/stagePoiLookup';
import { geoapifyObjectives } from '../server/geoapify';
import { parseGeoapifyObjectives } from '../engine/dayObjectives';
import { cached } from '../server/sharedCache';

const BASE = { lat: 49.29, lon: 19.95 };
const feature = (name: string | undefined, cat: string, lat: number, lon: number, raw: Record<string, unknown> = {}) => ({
  properties: { name, categories: [cat], lat, lon, datasource: { raw: { osm_id: Math.round(lat * 1000), osm_type: 'n', ...raw } } },
});
const geoPayload = {
  features: [
    feature('Giewont', 'natural.mountain.peak', 49.25, 19.93, { ele: '1894' }),
    feature('Morskie Oko', 'natural.water', 49.2, 20.07, { water: 'lake' }),
    feature(undefined, 'natural.mountain.peak', 49.3, 19.9),
    feature('Rivière X', 'natural.water', 49.31, 19.8, { water: 'river' }),
    feature('Kasprowy', 'tourism.attraction.viewpoint', 49.23, 19.98),
  ],
};
const fetchMock = vi.fn(async (..._a: unknown[]) => new Response(JSON.stringify(geoPayload), { status: 200 }));
const later = () => Date.now() + 60_000;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GEOAPIFY_API_KEY', 'test-key');
  overpassPost.mockImplementation(async () => new Response('{}', { status: 504 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  readShared.mockImplementation(async () => undefined);
  takeApiCredits.mockImplementation(async () => true);
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(geoPayload), { status: 200 }));
});

describe('parseGeoapifyObjectives', () => {
  it('garde les lieux nommés, convertis (nature, altitude), sans rivière ni lieu sans nom', () => {
    const found = parseGeoapifyObjectives(geoPayload);
    expect(found.map((o) => [o.name, o.kind, o.eleM])).toEqual([
      ['Giewont', 'peak', 1894],
      ['Morskie Oko', 'lake', null],
      ['Kasprowy', 'viewpoint', null],
    ]);
    expect(found.every((o) => o.source === 'geoapify')).toBe(true);
  });
  it('réponse invalide : liste vide', () => {
    expect(parseGeoapifyObjectives(null)).toEqual([]);
    expect(parseGeoapifyObjectives({ features: 'x' })).toEqual([]);
  });
});

describe('geoapifyObjectives', () => {
  it('sans clé : null, aucun appel, aucun crédit pris', async () => {
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    expect(await geoapifyObjectives(BASE, 11_000, 5000)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(takeApiCredits).not.toHaveBeenCalled();
  });
  it('crédits refusés : null, aucun appel', async () => {
    takeApiCredits.mockImplementation(async () => false);
    expect(await geoapifyObjectives(BASE, 11_000, 5000)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('crédits pris avant l’appel (5 pour 100 lieux), filtre en cercle, catégories vérifiées', async () => {
    const found = await geoapifyObjectives(BASE, 11_000, 5000, 'fr');
    expect(found).toHaveLength(3);
    expect(takeApiCredits).toHaveBeenCalledWith('geoapify', 5, 2700);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/v2/places');
    expect(url.searchParams.get('filter')).toBe('circle:19.95000,49.29000,11000');
    expect(url.searchParams.get('categories')).toBe('natural.mountain.peak,natural.water,tourism.attraction.viewpoint,accommodation.hut');
  });
  it('HTTP en erreur ou réponse invalide : null', async () => {
    fetchMock.mockImplementationOnce(async () => new Response('', { status: 500 }));
    expect(await geoapifyObjectives(BASE, 11_000, 5000)).toBeNull();
    fetchMock.mockImplementationOnce(async () => new Response('{"x":1}', { status: 200 }));
    expect(await geoapifyObjectives(BASE, 11_000, 5000)).toBeNull();
  });
});

describe('lookupAreaObjectives : Geoapify en secours d’Overpass', () => {
  it('Overpass 504 + Geoapify répond : objectifs trouvés, trace juste, pas de cache d’un mois, gardé 24 h', async () => {
    const diag: string[] = [];
    const found = await lookupAreaObjectives(BASE, later(), diag);
    expect(found?.map((o) => o.name)).toEqual(['Giewont', 'Morskie Oko', 'Kasprowy']);
    expect(diag).toEqual(['Objectifs : Overpass muet', 'Objectifs : Geoapify 3']);
    const keep = vi.mocked(cached).mock.calls.at(-1)?.[4] as (v: unknown) => boolean;
    expect(keep(found)).toBe(false);
    expect(writeShared).toHaveBeenCalledTimes(1);
    expect(writeShared.mock.calls[0][3]).toBe(86_400);
  });
  it('relit le cache de 24 h de Geoapify sans nouvel appel', async () => {
    readShared.mockImplementation(async () => parseGeoapifyObjectives(geoPayload));
    const diag: string[] = [];
    const found = await lookupAreaObjectives(BASE, later(), diag);
    expect(found).toHaveLength(3);
    expect(diag).toContain('Objectifs : Geoapify cache 3');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Geoapify muet : null, trace « Geoapify muet »', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 503 }));
    const diag: string[] = [];
    expect(await lookupAreaObjectives(BASE, later(), diag)).toBeNull();
    expect(diag).toEqual(['Objectifs : Overpass muet', 'Objectifs : Geoapify muet']);
  });
  it('sans clé : null, « Geoapify sans clé », aucun appel', async () => {
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    const diag: string[] = [];
    expect(await lookupAreaObjectives(BASE, later(), diag)).toBeNull();
    expect(diag).toEqual(['Objectifs : Overpass muet', 'Objectifs : Geoapify sans clé']);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('crédits refusés : aucun appel Geoapify', async () => {
    takeApiCredits.mockImplementation(async () => false);
    const diag: string[] = [];
    expect(await lookupAreaObjectives(BASE, later(), diag)).toBeNull();
    expect(diag).toContain('Objectifs : Geoapify muet');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('moins de 4 s restantes après Overpass : Geoapify non tenté', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      overpassPost.mockImplementation(async () => {
        vi.setSystemTime(Date.now() + 3500);
        return new Response('{}', { status: 504 });
      });
      const diag: string[] = [];
      expect(await lookupAreaObjectives(BASE, Date.now() + 7000, diag)).toBeNull();
      expect(diag).toContain('Objectifs : Geoapify plus de temps');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('Overpass répond : Geoapify jamais appelé, cache d’un mois inchangé', async () => {
    overpassPost.mockImplementation(
      async () =>
        new Response(JSON.stringify({ elements: [{ type: 'node', id: 5, lat: 49.25, lon: 19.93, tags: { natural: 'peak', name: 'Giewont' } }] }), { status: 200 })
    );
    const diag: string[] = [];
    const found = await lookupAreaObjectives(BASE, later(), diag);
    expect(found?.map((o) => o.name)).toEqual(['Giewont']);
    expect(found?.[0].source).toBeUndefined();
    expect(diag).toEqual(['Objectifs : Overpass 1']);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(takeApiCredits).not.toHaveBeenCalled();
    const keep = vi.mocked(cached).mock.calls.at(-1)?.[4] as (v: unknown) => boolean;
    expect(keep(found)).toBe(true);
  });
});
