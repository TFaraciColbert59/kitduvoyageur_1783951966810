import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Lire ce que la zone montre en transports en commun (gare, gare routière) sans
 * aucune requête au service public : le cache partagé seulement.
 */
const h = vi.hoisted(() => ({ cache: new Map<string, unknown>(), reads: [] as string[] }));
vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', () => ({
  readShared: async (_kind: string, key: string) => {
    h.reads.push(key);
    return h.cache.get(key);
  },
  cached: async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  coordKey: (lat: number, lon: number) => `${lat},${lon}`,
}));
import { readCachedStagePois } from '../server/stagePoiLookup';

const gare = { id: 1, name: 'Gare de Die', category: 'transport', lat: 44.75, lon: 5.37, distanceM: 400, elevationM: null };
const resto = { id: 2, name: 'Chez Paul', category: 'resto', lat: 44.75, lon: 5.37, distanceM: 100, elevationM: null };
const A = { lat: 44.75, lon: 5.37 };
const B = { lat: 45.07, lon: 5.55 };

describe('readCachedStagePois', () => {
  afterEach(() => {
    h.cache.clear();
    h.reads = [];
    vi.restoreAllMocks();
  });

  it('lit le cache seulement : aucune requête réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    h.cache.set('pois:v2:44.75,5.37', [resto, gare]);
    await readCachedStagePois([A, B]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('tous les lieux connus : complet', async () => {
    h.cache.set('pois:v2:44.75,5.37', [resto, gare]);
    h.cache.set('pois:v2:45.07,5.55', []);
    const out = await readCachedStagePois([A, B]);
    expect(out.complete).toBe(true);
    expect(out.pois.map((p) => p.name)).toEqual(['Chez Paul', 'Gare de Die']);
  });

  it('un lieu pas encore lu : incomplet, ce qui est connu est rendu', async () => {
    h.cache.set('pois:v2:44.75,5.37', [gare]);
    const out = await readCachedStagePois([A, B]);
    expect(out.complete).toBe(false);
    expect(out.pois).toHaveLength(1);
  });

  it('rien dans le cache, ou aucun point d’étape : incomplet et vide', async () => {
    expect(await readCachedStagePois([A])).toEqual({ pois: [], complete: false });
    expect(await readCachedStagePois([])).toEqual({ pois: [], complete: false });
  });
});
