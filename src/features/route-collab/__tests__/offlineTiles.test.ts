// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  TILE_CACHE_PREFIX,
  TILE_PACK_CAP_BYTES,
  TILE_SOURCE_MAX_ZOOM,
  corridorTilesAt,
  downloadTilePack,
  lonToTileX,
  planCorridorTiles,
  readTilePack,
  type KeyValueStore,
  type LonLat,
} from '../offlineTiles';

/** Une sortie de ~12 km dans les Alpes. */
const LINE: LonLat[] = Array.from({ length: 13 }, (_, i) => [6.8 + i * 0.012, 45.9 + i * 0.004] as LonLat);
const LONG: LonLat[] = [[-4, 43], [8, 50]];

describe('2.10 · plan des tuiles du corridor', () => {
  it('zooms 10 à 15 : la source vectorielle s’arrête au 14, le 15 est l’agrandissement du 14', () => {
    const plan = planCorridorTiles(LINE);
    expect(plan.fits).toBe(true);
    expect(plan.perZoom.map((p) => p.z)).toEqual([10, 11, 12, 13, 14]);
    expect(plan.fetchMaxZoom).toBe(TILE_SOURCE_MAX_ZOOM);
    expect(plan.announcement).toMatch(/zooms 10 à 15/);
    expect(plan.announcement).toMatch(/\d+ tuiles/);
    expect(plan.announcement).toMatch(/Mo|Ko/);
    expect(plan.reduced).toBe(false);
    expect(plan.capMessage).toBeNull();
  });

  it('le tampon d’environ 1 km couvre un point voisin du tracé mais pas un point à 20 km', () => {
    const z = 14;
    const tiles = corridorTilesAt([[6.8, 45.9], [6.9, 45.9]], z);
    expect(tiles.some((t) => t.x === lonToTileX(6.85, z))).toBe(true);
    expect(tiles.some((t) => t.x === lonToTileX(7.2, z))).toBe(false);
    // chaque tuile est contiguë au tracé : bande de 1 à 3 tuiles de haut au zoom 14
    expect(new Set(tiles.map((t) => t.y)).size).toBeLessThanOrEqual(3);
  });

  it('plafond de 60 Mo : un très long tracé perd ses zooms fins, avec un message', () => {
    const plan = planCorridorTiles(LONG);
    expect(plan.capBytes).toBe(TILE_PACK_CAP_BYTES);
    expect(plan.estimatedBytes).toBeLessThanOrEqual(TILE_PACK_CAP_BYTES);
    if (plan.fits) {
      expect(plan.reduced).toBe(true);
      expect(plan.fetchMaxZoom).toBeLessThan(TILE_SOURCE_MAX_ZOOM);
      expect(plan.capMessage).toMatch(/dépasserait 60 Mo/);
      expect(plan.capMessage).toMatch(/limité aux zooms 10 à \d+/);
    } else {
      expect(plan.announcement).toMatch(/trop long/);
    }
  });

  it('plafond trop bas : pas de fond, le tracé reste disponible, et le dit', () => {
    const plan = planCorridorTiles(LINE, 1_000_000);
    expect(plan.fits).toBe(false);
    expect(plan.tiles).toHaveLength(0);
    expect(plan.announcement).toMatch(/Le tracé et les étapes restent disponibles hors ligne/);
  });

  it('sans tracé : rien à préparer', () => {
    expect(planCorridorTiles([]).fits).toBe(false);
  });
});

/* ---------- Téléchargement : cache neuf, copie précédente intacte ---------- */

class FakeCache {
  entries = new Map<string, Response>();
  async put(url: string, res: Response) {
    this.entries.set(url, res);
  }
  async match(url: string) {
    return this.entries.get(url)?.clone();
  }
}
class FakeCaches {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async keys() {
    return [...this.stores.keys()];
  }
}
function memStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

const STYLE = {
  sprite: 'https://tiles.example/sprites/ofm',
  glyphs: 'https://tiles.example/fonts/{fontstack}/{range}.pbf',
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.example/planet' } },
  layers: [{ layout: { 'text-font': ['Noto Sans Regular'] } }],
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

function fakeFetch(opts: { failTiles?: boolean; tileBytes?: number } = {}) {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/styles/positron')) return json(STYLE);
    if (url === 'https://tiles.example/planet') return json({ tiles: ['https://tiles.example/planet/v1/{z}/{x}/{y}.pbf'] });
    if (url.includes('/planet/v1/')) return opts.failTiles ? new Response('', { status: 500 }) : new Response(new Uint8Array(opts.tileBytes ?? 1000), { status: 200 });
    return new Response(new Uint8Array(10), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

// L'adresse du style est lue depuis la constante du module ; la fausse réponse la reconnaît par son suffixe.
describe('2.10 · téléchargement du pack de tuiles', () => {
  it('écrit un cache neuf, le contrôle, puis seulement promeut la référence', async () => {
    const caches = new FakeCaches();
    const store = memStore();
    const { fn, calls } = fakeFetch();
    const res = await downloadTilePack({ workspaceId: 'w1', revisionNo: 2, line: LINE }, { fetchFn: fn, caches: caches as unknown as CacheStorage, store });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.meta.cacheName.startsWith(`${TILE_CACHE_PREFIX}w1:v2:`)).toBe(true);
    expect(res.meta.maxZoom).toBe(14);
    expect(readTilePack('w1', store)?.cacheName).toBe(res.meta.cacheName);
    const cache = caches.stores.get(res.meta.cacheName)!;
    // style, TileJSON, pictogrammes, glyphes et tuiles sont tous dans la copie
    expect([...cache.entries.keys()].some((u) => u.endsWith('/styles/positron'))).toBe(true);
    expect(cache.entries.has('https://tiles.example/planet')).toBe(true);
    expect([...cache.entries.keys()].some((u) => u.includes('/fonts/Noto Sans Regular/0-255.pbf'))).toBe(true);
    expect([...cache.entries.keys()].filter((u) => u.includes('/planet/v1/')).length).toBe(planCorridorTiles(LINE).tiles.length);
    expect(calls.length).toBeGreaterThan(planCorridorTiles(LINE).tiles.length);
  });

  it('mise à jour : l’ancienne copie n’est supprimée qu’après la nouvelle', async () => {
    const caches = new FakeCaches();
    const store = memStore();
    const first = await downloadTilePack({ workspaceId: 'w1', revisionNo: 1, line: LINE, }, { fetchFn: fakeFetch().fn, caches: caches as unknown as CacheStorage, store, now: () => new Date(1000) });
    const second = await downloadTilePack({ workspaceId: 'w1', revisionNo: 2, line: LINE }, { fetchFn: fakeFetch().fn, caches: caches as unknown as CacheStorage, store, now: () => new Date(2000) });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const names = [...caches.stores.keys()];
    expect(names).toEqual([second.meta.cacheName]);
    expect(readTilePack('w1', store)?.revisionNo).toBe(2);
  });

  it('un échec de téléchargement ne casse jamais la copie précédente', async () => {
    const caches = new FakeCaches();
    const store = memStore();
    const ok = await downloadTilePack({ workspaceId: 'w1', revisionNo: 1, line: LINE }, { fetchFn: fakeFetch().fn, caches: caches as unknown as CacheStorage, store, now: () => new Date(1000) });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const bad = await downloadTilePack({ workspaceId: 'w1', revisionNo: 2, line: LINE }, { fetchFn: fakeFetch({ failTiles: true }).fn, caches: caches as unknown as CacheStorage, store, now: () => new Date(2000) });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.reason).toMatch(/copie précédente reste utilisable/);
    expect(bad.previous?.cacheName).toBe(ok.meta.cacheName);
    expect(readTilePack('w1', store)?.cacheName).toBe(ok.meta.cacheName);
    expect([...caches.stores.keys()]).toEqual([ok.meta.cacheName]);
    expect(caches.stores.get(ok.meta.cacheName)!.entries.size).toBeGreaterThan(10);
  });

  it('interruption (signal) : cache neuf jeté, ancienne copie intacte', async () => {
    const caches = new FakeCaches();
    const store = memStore();
    const ctl = new AbortController();
    const base = fakeFetch().fn;
    const fn = (async (u: RequestInfo | URL, init?: RequestInit) => {
      if (String(u).includes('/planet/v1/')) ctl.abort();
      return base(u, init);
    }) as unknown as typeof fetch;
    const res = await downloadTilePack({ workspaceId: 'w1', revisionNo: 1, line: LINE, signal: ctl.signal }, { fetchFn: fn, caches: caches as unknown as CacheStorage, store });
    expect(res.ok).toBe(false);
    expect(caches.stores.size).toBe(0);
    expect(readTilePack('w1', store)).toBeNull();
  });

  it('plafond atteint avant le zoom 12 : rien n’est gardé', async () => {
    const caches = new FakeCaches();
    const store = memStore();
    const res = await downloadTilePack({ workspaceId: 'w1', revisionNo: 1, line: LINE }, { fetchFn: fakeFetch({ tileBytes: 70 * 1024 * 1024 }).fn, caches: caches as unknown as CacheStorage, store });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Plafond de 60 Mo/);
    expect(caches.stores.size).toBe(0);
  });
});

/* ---------- Service worker ---------- */

describe('2.10 · service worker du pack', () => {
  const src = readFileSync(path.join(process.cwd(), 'public/sw-route-tiles.js'), 'utf8');
  const loader = readFileSync(path.join(process.cwd(), 'public/sw-v18.js'), 'utf8');

  it('sw-v18 charge le module du pack et ne purge pas ses caches', () => {
    expect(loader).toContain("importScripts('/sw-route-tiles.js')");
    expect(loader).toContain("!k.startsWith('lkdv-route-tiles:')");
  });

  function run(cachesImpl: unknown, fetchImpl: typeof fetch) {
    const listeners: Array<(e: unknown) => void> = [];
    const ctx = { self: { addEventListener: (_t: string, l: (e: unknown) => void) => listeners.push(l) }, caches: cachesImpl, fetch: fetchImpl, Response, URL, console };
    vm.runInNewContext(src, ctx);
    return async (url: string, method = 'GET') => {
      let p: Promise<Response> | null = null;
      listeners[0]({ request: { url, method }, respondWith: (r: Promise<Response>) => (p = r) });
      return p ? await (p as Promise<Response>) : null;
    };
  }

  it('sert depuis la copie du corridor, sinon le réseau ; ignore les autres hôtes et les écritures', async () => {
    const caches = new FakeCaches();
    const c = await caches.open(`${TILE_CACHE_PREFIX}w1:v1:abc`);
    await c.put('https://tiles.openfreemap.org/planet/v1/12/2131/1437.pbf', new Response('PACK'));
    let network = 0;
    const get = run(caches, (async () => {
      network += 1;
      return new Response('NET');
    }) as unknown as typeof fetch);
    const hit = await get('https://tiles.openfreemap.org/planet/v1/12/2131/1437.pbf');
    expect(await hit!.text()).toBe('PACK');
    expect(network).toBe(0);
    const miss = await get('https://tiles.openfreemap.org/planet/v1/12/9/9.pbf');
    expect(await miss!.text()).toBe('NET');
    expect(await get('https://example.com/x.png')).toBeNull();
    expect(await get('https://tiles.openfreemap.org/planet/v1/12/2131/1437.pbf', 'POST')).toBeNull();
  });

  it('hors ligne et absent de la copie : 504, jamais d’exception', async () => {
    const get = run(new FakeCaches(), (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch);
    expect((await get('https://tiles.openfreemap.org/planet/v1/12/9/9.pbf'))!.status).toBe(504);
  });
});
