import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Branchement des référentiels `geo_rivers` (plan 3.6) et `geo_areas` (plan 3.3) dans la recherche
 * de lieux (`lookupRiver`, `lookupNatural`) : interrupteur allumé et nom connu → le lieu du
 * référentiel, sans Photon ; sinon, exactement le chemin d'avant. Photon est simulé à sa frontière
 * (`fetch`) avec ses réponses réelles du 7 octobre ; les référentiels par leurs modules serveur.
 */
vi.mock('server-only', () => ({}));
vi.mock('@/lib/siteSlot', () => ({ photonSlot: vi.fn(async () => true) }));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) =>
    fn()
  ),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/geoRivers', () => ({
  geoRiversEnabled: vi.fn(() => false),
  referentialRiver: vi.fn(async () => null),
}));
vi.mock('../server/geoAreas', () => ({
  geoAreasEnabled: vi.fn(() => false),
  referentialArea: vi.fn(async () => null),
}));

import { lookupNatural, lookupRiver } from '../server/placeLookup';
import { geoRiversEnabled, referentialRiver } from '../server/geoRivers';
import { geoAreasEnabled, referentialArea } from '../server/geoAreas';
import { pickArea, type GeoAreaRow } from '../engine/geoAreas';
import type { GeoRiverRow } from '../engine/geoRivers';
import tarn from './fixtures/photon-natural-tarn.json';
import leTarn from './fixtures/photon-natural-le-tarn.json';
import calanques from './fixtures/photon-natural-calanques.json';

const TARN: GeoRiverRow = {
  osm_id: 'r1234',
  name: 'Tarn',
  name_plain: 'tarn',
  alt_plain: [],
  canoe: 'yes',
  whitewater_grade: 2,
  length_km: null,
  lat: 44.1,
  lon: 2.4,
  west: 1.05,
  south: 43.98,
  east: 3.85,
  north: 44.42,
};

const area = (over: Partial<GeoAreaRow>): GeoAreaRow => ({
  osm_id: 'r1',
  kind: 'national_park',
  name: 'Parc national de la Vanoise',
  name_plain: 'vanoise',
  protect_class: '2',
  lat: 45.35,
  lon: 6.8,
  west: 6.55,
  south: 45.18,
  east: 7.1,
  north: 45.55,
  area_km2: null,
  ...over,
});

const FIXTURES: Record<string, unknown> = { Tarn: tarn, 'Le Tarn': leTarn, Calanques: calanques };
let urls: string[];

beforeEach(() => {
  urls = [];
  vi.mocked(geoRiversEnabled).mockReturnValue(false);
  vi.mocked(geoAreasEnabled).mockReturnValue(false);
  vi.mocked(referentialRiver).mockReset().mockResolvedValue(null);
  vi.mocked(referentialArea).mockReset().mockResolvedValue(null);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    urls.push(url);
    const q = new URL(url).searchParams.get('q') ?? '';
    return new Response(
      JSON.stringify(FIXTURES[q] ?? { type: 'FeatureCollection', features: [] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Le chemin d'avant (interrupteurs éteints) : lieu rendu et requêtes Photon, pour comparer. */
async function before<T>(run: () => Promise<T>): Promise<{ result: T; urls: string[] }> {
  vi.mocked(geoRiversEnabled).mockReturnValue(false);
  vi.mocked(geoAreasEnabled).mockReturnValue(false);
  const result = await run();
  const seen = [...urls];
  urls.length = 0;
  return { result, urls: seen };
}

describe('rivières : le référentiel avant Photon', () => {
  it('« Le Tarn » trouvé : la rivière du référentiel, son emprise [ouest, nord, est, sud], aucun appel Photon', async () => {
    vi.mocked(geoRiversEnabled).mockReturnValue(true);
    vi.mocked(referentialRiver).mockResolvedValue(TARN);
    const near = { lat: 43.8, lon: 1.7 };
    const p = await lookupRiver('Le Tarn', 'FR', { near });
    expect(referentialRiver).toHaveBeenCalledWith('Le Tarn', near);
    expect(urls).toHaveLength(0);
    expect(p).toEqual({
      name: 'Tarn',
      lat: 44.1,
      lon: 2.4,
      countryCode: null,
      country: null,
      kind: 'river',
      landmark: true,
      osmTag: 'waterway=river',
      extent: [1.05, 44.42, 3.85, 43.98],
    });
  });

  it('nom inconnu du référentiel : exactement la recherche d’avant (mêmes requêtes, même lieu)', async () => {
    const old = await before(() => lookupRiver('Tarn', 'FR'));
    expect(old.result?.osmTag).toBe('waterway=river');
    vi.mocked(geoRiversEnabled).mockReturnValue(true);
    const now = await lookupRiver('Tarn', 'FR');
    expect(referentialRiver).toHaveBeenCalledTimes(1);
    expect(now).toEqual(old.result);
    expect(urls).toEqual(old.urls);
  });

  it('interrupteur éteint : le référentiel n’est jamais interrogé', async () => {
    await lookupRiver('Le Tarn', 'FR', { near: { lat: 43.8, lon: 1.7 } });
    await lookupRiver('Tarn', 'FR', { referential: 'only' });
    expect(referentialRiver).not.toHaveBeenCalled();
  });

  it('« only » : le référentiel seul (rien ou interrupteur éteint → null, sans Photon) ; « skip » : Photon seul', async () => {
    expect(await lookupRiver('Tarn', 'FR', { referential: 'only' })).toBeNull();
    vi.mocked(geoRiversEnabled).mockReturnValue(true);
    expect(await lookupRiver('Tarn', 'FR', { referential: 'only' })).toBeNull();
    expect(urls).toHaveLength(0);
    vi.mocked(referentialRiver).mockResolvedValue(TARN);
    expect((await lookupRiver('Tarn', 'FR', { referential: 'only' }))?.extent).toEqual([
      1.05, 44.42, 3.85, 43.98,
    ]);
    vi.mocked(referentialRiver).mockClear();
    const skipped = await lookupRiver('Tarn', 'FR', { referential: 'skip' });
    expect(referentialRiver).not.toHaveBeenCalled();
    expect(skipped?.osmTag).toBe('waterway=river');
    expect(urls.length).toBeGreaterThan(0);
  });

  it('base muette (erreur) : repli sur Photon, comme avant', async () => {
    const old = await before(() => lookupRiver('Tarn', 'FR'));
    vi.mocked(geoRiversEnabled).mockReturnValue(true);
    vi.mocked(referentialRiver).mockRejectedValue(new Error('base'));
    expect(await lookupRiver('Tarn', 'FR')).toEqual(old.result);
    expect(urls).toEqual(old.urls);
  });
});

describe('parcs et espaces protégés : le référentiel avant Photon', () => {
  it('« Calanques » trouvé : le parc du référentiel avec son emprise, aucun appel Photon', async () => {
    vi.mocked(geoAreasEnabled).mockReturnValue(true);
    vi.mocked(referentialArea).mockResolvedValue(
      area({
        osm_id: 'r2',
        name: 'Parc national des Calanques',
        name_plain: 'calanques',
        lat: 43.21,
        lon: 5.45,
        west: 5.17,
        south: 43.09,
        east: 5.69,
        north: 43.27,
      })
    );
    const p = await lookupNatural('Calanques', 'FR');
    expect(referentialArea).toHaveBeenCalledWith('Calanques');
    expect(urls).toHaveLength(0);
    expect(p).toEqual({
      name: 'Parc national des Calanques',
      lat: 43.21,
      lon: 5.45,
      countryCode: null,
      country: null,
      kind: 'national_park',
      landmark: true,
      osmTag: 'boundary=national_park',
      extent: [5.17, 43.27, 5.69, 43.09],
    });
  });

  it('« Parc national de la Vanoise » trouvé : son emprise ; une aire protégée et une réserve gardent leur étiquette OSM', async () => {
    vi.mocked(geoAreasEnabled).mockReturnValue(true);
    vi.mocked(referentialArea).mockResolvedValue(area({}));
    const p = await lookupNatural('Parc national de la Vanoise', 'FR');
    expect(referentialArea).toHaveBeenCalledWith('Parc national de la Vanoise');
    expect(p?.extent).toEqual([6.55, 45.55, 7.1, 45.18]);
    expect(urls).toHaveLength(0);
    vi.mocked(referentialArea).mockResolvedValue(
      area({ kind: 'protected_area', protect_class: '5' })
    );
    expect((await lookupNatural('Vanoise', 'FR'))?.osmTag).toBe('boundary=protected_area');
    vi.mocked(referentialArea).mockResolvedValue(
      area({ kind: 'nature_reserve', protect_class: null })
    );
    expect((await lookupNatural('Vanoise', 'FR'))?.osmTag).toBe('leisure=nature_reserve');
  });

  it('homonymes : le plus étendu des espaces du même nom (pickArea), branché tel quel', async () => {
    const rows = [
      area({
        osm_id: 'r10',
        kind: 'nature_reserve',
        name: 'Réserve naturelle de la Vanoise',
        west: 6.7,
        south: 45.3,
        east: 6.8,
        north: 45.4,
      }),
      area({ osm_id: 'r20' }),
    ];
    vi.mocked(geoAreasEnabled).mockReturnValue(true);
    vi.mocked(referentialArea).mockImplementation(async (name: string) => pickArea(rows, name));
    const p = await lookupNatural('Vanoise', 'FR');
    expect(p?.name).toBe('Parc national de la Vanoise');
    expect(p?.extent).toEqual([6.55, 45.55, 7.1, 45.18]);
  });

  it('nom inconnu ou base muette : exactement la recherche d’avant', async () => {
    const old = await before(() => lookupNatural('Calanques', 'FR'));
    expect(old.result).not.toBeNull();
    vi.mocked(geoAreasEnabled).mockReturnValue(true);
    expect(await lookupNatural('Calanques', 'FR')).toEqual(old.result);
    expect(urls).toEqual(old.urls);
    urls.length = 0;
    vi.mocked(referentialArea).mockRejectedValue(new Error('base'));
    expect(await lookupNatural('Calanques', 'FR')).toEqual(old.result);
    expect(urls).toEqual(old.urls);
  });

  it('interrupteur éteint : le référentiel n’est jamais interrogé', async () => {
    await lookupNatural('Calanques', 'FR');
    await lookupNatural('Vanoise', null, true);
    expect(referentialArea).not.toHaveBeenCalled();
  });

  it('nom trop court : null avant tout appel, comme avant', async () => {
    vi.mocked(geoAreasEnabled).mockReturnValue(true);
    expect(await lookupNatural('Va', 'FR')).toBeNull();
    expect(referentialArea).not.toHaveBeenCalled();
    expect(urls).toHaveLength(0);
  });
});
