/**
 * Plan 1.6 : le fond « standard » de la carte MapLibre vient d'OpenFreeMap (vecteur, sans clé),
 * le relief et le satellite restent chez ArcGIS, et un repli UNIQUE sur l'ArcGIS « standard »
 * rattrape une panne d'OpenFreeMap (qui « peut s'arrêter sans préavis », conditions du 9 sept. 2026).
 *
 * Aucun réseau ici : la lecture du style est injectée, la carte est une doublure qui note ses appels.
 * Le chargement réel des tuiles ne peut pas se prouver hors ligne (voir PLAN-100 §1.6).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { atlasTiles, createMapStyle } from '@/components/map/engine/createMapStyle';
import {
  ALLOWED_TILE_HOSTS,
  OPENFREEMAP_ATTRIBUTION,
  OPENFREEMAP_ATTRIBUTION_SHORT,
  OPENFREEMAP_HOST,
  OPENFREEMAP_STYLE_URL,
  basemapCredit,
  classifyMapError,
  createBasemapFallback,
  parseOpenFreeMapStyle,
  selectBasemap,
} from '@/components/map/engine/openFreeMap';
import {
  createOpenFreeMapBasemap,
  type BasemapMap,
} from '@/components/map/engine/openFreeMapBasemap';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

/** Un style à la forme de https://tiles.openfreemap.org/styles/liberty (lu le 13 oct. 2026), réduit. */
function libertyLike() {
  return {
    version: 8,
    sources: {
      ne2_shaded: {
        maxzoom: 6,
        tileSize: 256,
        tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'],
        type: 'raster',
      },
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': 'rgb(240,240,240)' } },
      { id: 'natural_earth', type: 'raster', source: 'ne2_shaded', maxzoom: 7 },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': 'rgb(150,180,250)' },
      },
      {
        id: 'road_minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', 'class', 'minor'],
      },
      {
        id: 'highway-name-minor',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'] },
      },
    ],
  };
}

type Spec = Record<string, unknown> & { id?: string };

/** Doublure de carte MapLibre : note les appels et garde l'état utile aux assertions. */
function fakeMap(
  initialLayers: string[] = [
    'atlas-background',
    'atlas-tile-topo',
    'atlas-tile-osm',
    'atlas-tile-satellite',
  ]
) {
  const layers: Array<{ id: string; before?: string; visibility?: string; spec: Spec }> =
    initialLayers.map((id) => ({
      id,
      spec: { id },
    }));
  const sources = new Set<string>();
  const state: { glyphs: string | null | undefined; sprite: string | null | undefined } = {
    glyphs: undefined,
    sprite: undefined,
  };
  const map = {
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addSource: (id: string) => void sources.add(id),
    removeSource: (id: string) => {
      if (!sources.delete(id)) throw new Error(`source « ${id} » absente`);
    },
    addLayer: (spec: Spec, before?: string) => {
      const index = before ? layers.findIndex((l) => l.id === before) : layers.length;
      layers.splice(index, 0, {
        id: String(spec.id),
        before,
        visibility: (spec.layout as { visibility?: string } | undefined)?.visibility,
        spec,
      });
    },
    removeLayer: (id: string) => {
      const index = layers.findIndex((l) => l.id === id);
      if (index === -1) throw new Error(`couche « ${id} » absente`);
      layers.splice(index, 1);
    },
    setLayoutProperty: (id: string, name: string, value: string) => {
      const layer = layers.find((l) => l.id === id);
      if (!layer) throw new Error(`couche « ${id} » absente`);
      if (name === 'visibility') layer.visibility = value;
    },
    setGlyphs: (url: string | null) => void (state.glyphs = url),
    setSprite: (url: string | null) => void (state.sprite = url),
  };
  const ofmLayers = () => layers.filter((l) => l.id.startsWith('ofm-'));
  return { map: map as unknown as BasemapMap, layers, sources, state, ofmLayers };
}

function setup(
  options: {
    fetchStyle?: (url: string, signal: AbortSignal) => Promise<unknown>;
    tileErrorLimit?: number;
    timeoutMs?: number;
  } = {}
) {
  const fake = fakeMap();
  const fetchStyle = vi.fn(options.fetchStyle ?? (async () => libertyLike()));
  const onFallback = vi.fn();
  const onReady = vi.fn();
  const warn = vi.fn();
  const basemap = createOpenFreeMapBasemap(fake.map, {
    beforeLayerId: 'atlas-tile-topo',
    fetchStyle,
    onFallback,
    onReady,
    warn,
    tileErrorLimit: options.tileErrorLimit,
    timeoutMs: options.timeoutMs,
  });
  return { ...fake, basemap, fetchStyle, onFallback, onReady, warn };
}

describe('choix du fond par mode', () => {
  it('standard -> style OpenFreeMap ; relief et satellite -> ArcGIS', () => {
    expect(selectBasemap('osm')).toEqual({
      provider: 'openfreemap',
      styleUrl: OPENFREEMAP_STYLE_URL,
    });
    expect(selectBasemap('topo')).toEqual({ provider: 'arcgis', mode: 'topo' });
    expect(selectBasemap('satellite')).toEqual({ provider: 'arcgis', mode: 'satellite' });
    // Les tuiles du relief et du satellite sont bien celles d'ArcGIS (avec la clé du site).
    const tiles = atlasTiles('cle-test');
    expect(tiles.topo.tiles[0]).toContain('arcgis.com');
    expect(tiles.satellite.tiles[0]).toContain('arcgis.com');
  });

  it('l’adresse du style est celle de « liberty » chez OpenFreeMap, sans clé ni jeton', () => {
    expect(OPENFREEMAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/liberty');
    expect(new URL(OPENFREEMAP_STYLE_URL).search).toBe('');
    expect(new URL(OPENFREEMAP_STYLE_URL).hostname).toBe(OPENFREEMAP_HOST);
  });

  it('après un échec d’OpenFreeMap, le standard retombe sur ArcGIS', () => {
    expect(selectBasemap('osm', { openFreeMapFailed: true })).toEqual({
      provider: 'arcgis',
      mode: 'osm',
    });
    expect(atlasTiles('cle-test').osm.tiles[0]).toContain('/open/osm-style/static/tile/');
  });

  it('le style du site garde le raster ArcGIS « standard » et la couche devant laquelle OpenFreeMap se pose', () => {
    const ids = createMapStyle('topo').layers.map((l) => l.id);
    expect(ids).toContain('atlas-tile-osm');
    expect(ids.indexOf('atlas-tile-topo')).toBeGreaterThan(ids.indexOf('atlas-background'));
  });
});

describe('attribution', () => {
  it('le texte exigé par OpenFreeMap, sans y toucher', () => {
    expect(OPENFREEMAP_ATTRIBUTION).toBe('OpenFreeMap © OpenMapTiles Data from OpenStreetMap');
  });

  it('pastille repliée : les trois noms ; dépliée : le texte exact', () => {
    for (const name of ['OpenFreeMap', 'OpenMapTiles', 'OpenStreetMap'])
      expect(OPENFREEMAP_ATTRIBUTION_SHORT).toContain(name);
    expect(basemapCredit('osm', 'openfreemap')).toEqual({
      short: OPENFREEMAP_ATTRIBUTION_SHORT,
      credits: OPENFREEMAP_ATTRIBUTION,
    });
  });

  it('seulement quand OpenFreeMap est affiché : relief, satellite et repli gardent « Powered by Esri »', () => {
    const tiles = atlasTiles('cle-test');
    for (const [mode, provider] of [
      ['topo', 'openfreemap'],
      ['satellite', 'openfreemap'],
      ['osm', 'arcgis'],
    ] as const) {
      const credit = basemapCredit(mode, provider, tiles);
      expect(credit.short, `${mode}/${provider}`).toContain('Powered by Esri');
      expect(credit.credits).not.toContain('OpenFreeMap');
    }
  });
});

describe('lecture du style OpenFreeMap', () => {
  it('préfixe sources et couches, garde l’ordre, rend glyphes et sprite', () => {
    const style = parseOpenFreeMapStyle(libertyLike());
    expect(Object.keys(style.sources)).toEqual(['ofm-ne2_shaded', 'ofm-openmaptiles']);
    expect(style.layers.map((l) => l.id)).toEqual([
      'ofm-background',
      'ofm-natural_earth',
      'ofm-water',
      'ofm-road_minor',
      'ofm-highway-name-minor',
    ]);
    expect(style.layers.find((l) => l.id === 'ofm-water')).toMatchObject({
      source: 'ofm-openmaptiles',
      'source-layer': 'water',
    });
    expect(style.glyphs).toContain('{fontstack}');
    expect(style.sprite).toBe('https://tiles.openfreemap.org/sprites/ofm_f384/ofm');
    // Aucun identifiant du site ne peut être écrasé.
    expect(style.layers.every((l) => !l.id.startsWith('atlas-'))).toBe(true);
  });

  it('refuse une adresse hors de tiles.openfreemap.org (sprite, glyphes, tuiles, source)', () => {
    const wrongSprite = { ...libertyLike(), sprite: 'https://evil.example/sprite' };
    const wrongGlyphs = {
      ...libertyLike(),
      glyphs: 'http://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    };
    const wrongSource = libertyLike();
    wrongSource.sources.openmaptiles = {
      type: 'vector',
      url: 'https://tiles.openfreemap.org.evil.example/planet',
    };
    for (const raw of [wrongSprite, wrongGlyphs, wrongSource])
      expect(() => parseOpenFreeMapStyle(raw)).toThrow(/illisible/);
  });

  it('refuse ce qui n’est pas un style version 8, ou sans couche utilisable', () => {
    expect(() => parseOpenFreeMapStyle(null)).toThrow(/illisible/);
    expect(() => parseOpenFreeMapStyle('<html>')).toThrow(/illisible/);
    expect(() => parseOpenFreeMapStyle({ ...libertyLike(), version: 7 })).toThrow(/illisible/);
    expect(() => parseOpenFreeMapStyle({ ...libertyLike(), layers: [] })).toThrow(/illisible/);
    expect(() =>
      parseOpenFreeMapStyle({
        ...libertyLike(),
        layers: [{ id: 'x', type: 'fill', source: 'inconnue' }],
      })
    ).toThrow(/aucune couche utilisable/);
  });

  it('écarte la couche qui vise une source absente, sans rien casser d’autre', () => {
    const raw = libertyLike();
    raw.layers.push({ id: 'orpheline', type: 'fill', source: 'absente' } as never);
    expect(parseOpenFreeMapStyle(raw).layers.map((l) => l.id)).not.toContain('ofm-orpheline');
  });
});

describe('politique de repli', () => {
  it('un échec de style ou de source bascule tout de suite, une seule fois', () => {
    const style = createBasemapFallback();
    expect(style.report({ kind: 'style', message: 'HTTP 503' })).toBe(true);
    expect(style.triggered).toBe(true);
    expect(style.report({ kind: 'style', message: 'encore' })).toBe(false);
    expect(style.report({ kind: 'source', message: 'TileJSON' })).toBe(false);
    expect(createBasemapFallback().report({ kind: 'source', message: 'TileJSON' })).toBe(true);
  });

  it('une tuile isolée perdue ne fait pas quitter OpenFreeMap ; la troisième, si ; un 404 ne compte jamais', () => {
    const policy = createBasemapFallback();
    for (let i = 0; i < 10; i += 1)
      expect(policy.report({ kind: 'tile', message: 'absente', status: 404 })).toBe(false);
    expect(policy.report({ kind: 'tile', message: 'réseau' })).toBe(false);
    expect(policy.report({ kind: 'tile', message: 'HTTP 500', status: 500 })).toBe(false);
    expect(policy.report({ kind: 'tile', message: 'HTTP 503', status: 503 })).toBe(true);
    expect(policy.report({ kind: 'tile', message: 'HTTP 503', status: 503 })).toBe(false);
  });

  it('reconnaît les erreurs d’OpenFreeMap et laisse passer les autres', () => {
    expect(
      classifyMapError({ sourceId: 'ofm-openmaptiles', error: { message: 'x' } })
    ).toMatchObject({ kind: 'source' });
    expect(
      classifyMapError({
        sourceId: 'ofm-openmaptiles',
        tile: {},
        error: { message: 'x', status: 500 },
      })
    ).toMatchObject({
      kind: 'tile',
      status: 500,
    });
    expect(
      classifyMapError({
        error: {
          message: 'Failed',
          url: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm.json',
          status: 0,
        },
      })
    ).toMatchObject({ kind: 'tile' });
    expect(classifyMapError({ sourceId: 'atlas-trails', error: { message: 'x' } })).toBeNull();
    expect(
      classifyMapError({ error: { message: 'Failed to fetch /data/countries-110m.geojson' } })
    ).toBeNull();
    expect(classifyMapError(undefined)).toBeNull();
  });
});

describe('fond OpenFreeMap sur la carte', () => {
  it('rien n’est demandé tant que le mode « Plan » n’est pas choisi', () => {
    const { basemap, fetchStyle, ofmLayers } = setup();
    expect(basemap.status).toBe('idle');
    basemap.hide();
    expect(fetchStyle).not.toHaveBeenCalled();
    expect(ofmLayers()).toHaveLength(0);
  });

  it('au premier affichage : style lu une fois, couches posées sous les fonds ArcGIS, visibles', async () => {
    const { basemap, fetchStyle, layers, sources, state, ofmLayers } = setup();
    basemap.show();
    await vi.waitFor(() => expect(basemap.status).toBe('visible'));
    expect(fetchStyle).toHaveBeenCalledTimes(1);
    expect(fetchStyle.mock.calls[0][0]).toBe(OPENFREEMAP_STYLE_URL);
    expect([...sources]).toEqual(['ofm-ne2_shaded', 'ofm-openmaptiles']);
    expect(state.glyphs).toContain(OPENFREEMAP_HOST);
    expect(state.sprite).toContain(OPENFREEMAP_HOST);
    expect(ofmLayers()).toHaveLength(5);
    expect(ofmLayers().every((l) => l.visibility === 'visible')).toBe(true);
    // Ordre : le fond du site, puis OpenFreeMap, puis les rasters ArcGIS (et tout ce que le site pose ensuite).
    const order = layers.map((l) => l.id);
    expect(order[0]).toBe('atlas-background');
    expect(order.indexOf('ofm-highway-name-minor')).toBeLessThan(order.indexOf('atlas-tile-topo'));
    expect(order.indexOf('ofm-background')).toBeGreaterThan(order.indexOf('atlas-background'));
  });

  it('« prêt » est dit une fois, quand le style est posé (la carte garde le raster jusque-là)', async () => {
    const { basemap, onReady } = setup();
    basemap.show();
    expect(basemap.status).toBe('loading');
    expect(onReady).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(basemap.status).toBe('visible'));
    expect(onReady).toHaveBeenCalledTimes(1);
    basemap.hide();
    basemap.show();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('style en panne : jamais « prêt », seulement le repli', async () => {
    const { basemap, onReady, onFallback } = setup({
      fetchStyle: async () => {
        throw new Error('HTTP 503');
      },
    });
    basemap.show();
    await vi.waitFor(() => expect(onFallback).toHaveBeenCalledTimes(1));
    expect(onReady).not.toHaveBeenCalled();
  });

  it('masquer puis réafficher ne relit rien', async () => {
    const { basemap, fetchStyle, ofmLayers } = setup();
    basemap.show();
    await vi.waitFor(() => expect(basemap.status).toBe('visible'));
    basemap.hide();
    expect(basemap.status).toBe('hidden');
    expect(ofmLayers().every((l) => l.visibility === 'none')).toBe(true);
    basemap.show();
    expect(basemap.status).toBe('visible');
    expect(ofmLayers().every((l) => l.visibility === 'visible')).toBe(true);
    expect(fetchStyle).toHaveBeenCalledTimes(1);
  });

  it('choisir un autre fond pendant la lecture : les couches arrivent masquées', async () => {
    let release: (value: unknown) => void = () => {};
    const { basemap, ofmLayers } = setup({
      fetchStyle: () => new Promise((resolve) => (release = resolve)),
    });
    basemap.show();
    basemap.hide();
    release(libertyLike());
    await vi.waitFor(() => expect(basemap.status).toBe('hidden'));
    expect(ofmLayers().length).toBeGreaterThan(0);
    expect(ofmLayers().every((l) => l.visibility === 'none')).toBe(true);
  });
});

describe('repli sur l’ArcGIS « standard » : une seule fois, sans boucle', () => {
  it('erreur de style : un seul basculement, rien d’ajouté, jamais de seconde tentative', async () => {
    const { basemap, fetchStyle, onFallback, warn, ofmLayers, sources } = setup({
      fetchStyle: async () => {
        throw new Error('HTTP 503');
      },
    });
    basemap.show();
    await vi.waitFor(() => expect(basemap.status).toBe('fallback'));
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback.mock.calls[0][0]).toMatchObject({ kind: 'style', message: 'HTTP 503' });
    expect(ofmLayers()).toHaveLength(0);
    expect(sources.size).toBe(0);

    // Tout ce qui peut suivre ne déclenche ni second basculement, ni nouvelle lecture, ni bruit.
    basemap.show();
    basemap.hide();
    basemap.show();
    expect(basemap.handleError({ sourceId: 'ofm-openmaptiles', error: { message: 'x' } })).toBe(
      true
    );
    for (let i = 0; i < 20; i += 1)
      basemap.handleError({
        sourceId: 'ofm-openmaptiles',
        tile: {},
        error: { message: 'x', status: 500 },
      });
    expect(basemap.status).toBe('fallback');
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(fetchStyle).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('repli sur le fond ArcGIS');
  });

  it('un style qui n’est pas du JSON de style (page d’erreur, autre hôte) replie aussi', async () => {
    const { basemap, onFallback } = setup({
      fetchStyle: async () => '<html>502 Bad Gateway</html>',
    });
    basemap.show();
    await vi.waitFor(() => expect(basemap.status).toBe('fallback'));
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback.mock.calls[0][0]).toMatchObject({ kind: 'style' });
  });

  it('un style qui ne répond pas dans le délai replie', async () => {
    const { basemap, onFallback } = setup({
      timeoutMs: 20,
      fetchStyle: (_url, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('interrompu')))
        ),
    });
    basemap.show();
    await vi.waitFor(() => expect(basemap.status).toBe('fallback'));
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback.mock.calls[0][0].message).toContain('délai');
  });

  it('erreur de la source après l’affichage : couches, sources, glyphes et sprite retirés, un seul basculement', async () => {
    const { basemap, onFallback, warn, ofmLayers, sources, state, layers } = setup();
    basemap.show();
    await vi.waitFor(() => expect(basemap.status).toBe('visible'));

    // Une erreur qui n'est pas celle d'OpenFreeMap n'est pas prise en charge (le site la journalise).
    expect(basemap.handleError({ sourceId: 'atlas-trails', error: { message: 'x' } })).toBe(false);
    expect(basemap.status).toBe('visible');

    expect(
      basemap.handleError({ sourceId: 'ofm-openmaptiles', error: { message: 'Failed to fetch' } })
    ).toBe(true);
    expect(basemap.status).toBe('fallback');
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(ofmLayers()).toHaveLength(0);
    expect(sources.size).toBe(0);
    expect(state.glyphs).toBeNull();
    expect(state.sprite).toBeNull();
    // Les couches du site sont intactes : la carte reste utilisable.
    expect(layers.map((l) => l.id)).toEqual([
      'atlas-background',
      'atlas-tile-topo',
      'atlas-tile-osm',
      'atlas-tile-satellite',
    ]);

    // Les erreurs qui arrivent encore d'OpenFreeMap sont avalées : ni second basculement, ni ligne de console.
    for (let i = 0; i < 50; i += 1) {
      expect(
        basemap.handleError({
          sourceId: 'ofm-openmaptiles',
          tile: {},
          error: { message: 'x', status: 500 },
        })
      ).toBe(true);
    }
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('tuiles : les 404 sont ignorés, deux pertes passent, la troisième replie', async () => {
    const { basemap, onFallback } = setup();
    basemap.show();
    await vi.waitFor(() => expect(basemap.status).toBe('visible'));
    const tile = (status?: number) => ({
      sourceId: 'ofm-openmaptiles',
      tile: {},
      error: { message: 'x', status },
    });
    for (let i = 0; i < 12; i += 1) expect(basemap.handleError(tile(404))).toBe(true);
    basemap.handleError(tile(500));
    basemap.handleError(tile());
    expect(onFallback).not.toHaveBeenCalled();
    expect(basemap.status).toBe('visible');
    basemap.handleError(tile(503));
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(basemap.status).toBe('fallback');
  });

  it('carte démontée pendant la lecture : plus aucun appel à la carte, aucun repli', async () => {
    let release: (value: unknown) => void = () => {};
    const { basemap, onFallback, ofmLayers, sources } = setup({
      fetchStyle: () => new Promise((resolve) => (release = resolve)),
    });
    basemap.show();
    basemap.dispose();
    release(libertyLike());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(basemap.status).toBe('disposed');
    expect(ofmLayers()).toHaveLength(0);
    expect(sources.size).toBe(0);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('couche de pose absente : repli plutôt qu’un fond posé par-dessus les sentiers', async () => {
    const fake = fakeMap(['atlas-background']);
    const onFallback = vi.fn();
    const basemap = createOpenFreeMapBasemap(fake.map, {
      beforeLayerId: 'atlas-tile-topo',
      fetchStyle: async () => libertyLike(),
      onFallback,
      warn: () => {},
    });
    basemap.show();
    await vi.waitFor(() => expect(basemap.status).toBe('fallback'));
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(fake.ofmLayers()).toHaveLength(0);
  });
});

describe('branchement dans la carte du site', () => {
  const component = read('src/components/map/UnifiedExplorerMap.tsx');

  it('le fond est créé au chargement du style, sous la première couche raster d’ArcGIS', () => {
    expect(component).toMatch(
      /createOpenFreeMapBasemap\(instance, \{\s*beforeLayerId: 'atlas-tile-topo'/
    );
  });

  it('les erreurs d’OpenFreeMap passent par le fond avant la console (pas une ligne par tuile)', () => {
    expect(component).toMatch(
      /basemapRef\.current\?\.handleError\(event\)\) return;\s*console\.error\('\[UnifiedExplorerMap\] MapLibre error'/
    );
  });

  it('le fond est arrêté avant la suppression de la carte', () => {
    expect(component).toMatch(/basemapRef\.current\?\.dispose\(\);[\s\S]{0,120}map\.remove\(\)/);
  });

  it('le raster ArcGIS « standard » reste affiché tant qu’OpenFreeMap n’est pas posé, et après un repli', () => {
    expect(component).toMatch(
      /const wantOpenFreeMap = tileMode === 'osm' && basemap != null && basemap\.status !== 'fallback'/
    );
    expect(component).toMatch(/if \(wantOpenFreeMap\) basemap\.show\(\);\s*else basemap\?\.hide\(\)/);
    // Masqué seulement quand le style OpenFreeMap est réellement posé (pas pendant le chargement).
    expect(component).toMatch(/const openFreeMapShown = wantOpenFreeMap && basemap\.status === 'visible'/);
    expect(component).toMatch(/mode === tileMode && !\(mode === 'osm' && openFreeMapShown\)/);
    // Le fond posé relance l'effet (onReady → état), sans attendre un autre changement de mode.
    expect(component).toMatch(/onReady: \(\) => \{\s*if \(!cancelled\) setOpenFreeMapLoaded\(true\)/);
    expect(component).toMatch(/\[tileMode, ready, standardProvider, openFreeMapLoaded\]/);
  });

  it('la pastille dit le fond réellement affiché', () => {
    // OpenFreeMap n'est crédité qu'une fois posé : pendant le chargement, le raster ArcGIS est affiché.
    expect(component).toMatch(
      /basemapCredit\(\s*tileMode,\s*standardProvider === 'openfreemap' && openFreeMapLoaded \? 'openfreemap' : 'arcgis'\s*\)/
    );
    expect(component).toContain('credit.credits');
    expect(component).not.toMatch(/ATLAS_TILES\[tileMode\]/);
  });
});

describe('hôtes autorisés', () => {
  it('liste ArcGIS (clé du site) et OpenFreeMap', () => {
    expect([...ALLOWED_TILE_HOSTS].sort()).toEqual([
      'ibasemaps-api.arcgis.com',
      'static-map-tiles-api.arcgis.com',
      'tiles.openfreemap.org',
    ]);
  });
});
