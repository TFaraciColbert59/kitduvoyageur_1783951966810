import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StyleSpecification } from 'maplibre-gl';
import {
  MAPTOOLKIT_HOSTS,
  applyLkdvIdentity,
  buildCartoStyle,
  isCacheableTileUrl,
  maptoolkitAttributionHtml,
  withSatelliteBase,
  withTerrain,
} from '@/features/carto/maptoolkit';

/**
 * Base cartographique Maptoolkit (chantier CARTO).
 * Les tests s'appuient sur le style officiel réellement téléchargé
 * (`.cache/carto/hiking-3d.json`) : si le fichier est absent, le test vérifie
 * au moins les fonctions pures et le signale.
 */

const FIXTURE = '.cache/carto/hiking-3d.json';
const official: StyleSpecification | null = existsSync(FIXTURE)
  ? (JSON.parse(readFileSync(FIXTURE, 'utf8')) as StyleSpecification)
  : null;

describe('carto · licence et attribution', () => {
  it('attribue Maptoolkit et OpenStreetMap avec des liens actifs', () => {
    const html = maptoolkitAttributionHtml();
    expect(html).toContain('© Maptoolkit');
    expect(html).toContain('© Openstreetmap');
    expect(html).toContain('maptoolkit.com/copyright');
    expect(html).toContain('openstreetmap.org/copyright');
  });

  it('interdit la mise en cache hors ligne des tuiles Maptoolkit et ArcGIS', () => {
    expect(isCacheableTileUrl('https://tiles.maptoolkit.org/v8/mtk-contours/12/2098/1445.mvt')).toBe(false);
    expect(isCacheableTileUrl('https://fonts.maptoolkit.org/Noto/0-255.pbf')).toBe(false);
    expect(isCacheableTileUrl('https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/12/1445/2098')).toBe(false);
    expect(isCacheableTileUrl('https://tiles.openfreemap.org/planet/12/2098/1445.pbf')).toBe(true);
    expect(isCacheableTileUrl('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/2098/1445.png')).toBe(true);
  });
});

describe('carto · construction du style', () => {
  it('active le terrain 3D et le retire proprement', () => {
    const base = { version: 8, sources: {}, layers: [] } as unknown as StyleSpecification;
    const withT = withTerrain(base, true);
    expect(withT.terrain).toBeDefined();
    const without = withTerrain(withT, false);
    expect(without.terrain).toBeUndefined();
  });

  it('insère le satellite sous le style sans toucher aux sources Maptoolkit', () => {
    const style = {
      version: 8,
      sources: { mtk: { type: 'vector', url: 'https://tiles.maptoolkit.org/mtk-contours.json' } },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
        { id: 'nature_landuse', type: 'fill', source: 'mtk', paint: { 'fill-color': '#eee' } },
        { id: 'trails', type: 'line', source: 'mtk' },
      ],
    } as unknown as StyleSpecification;

    const hybrid = withSatelliteBase(style, 'CLE_TEST', 0.3);
    expect(hybrid.sources.mtk).toEqual(style.sources.mtk);
    expect(hybrid.sources['lkdv-satellite']).toBeDefined();
    const ids = hybrid.layers.map((layer) => layer.id);
    expect(ids.indexOf('lkdv-satellite-raster')).toBe(1);
    expect(ids).toContain('trails');
    const fill = hybrid.layers.find((layer) => layer.id === 'nature_landuse') as { paint: Record<string, unknown> };
    expect(fill.paint['fill-opacity']).toBe(0.3);
    const background = hybrid.layers.find((layer) => layer.id === 'background') as { paint: Record<string, unknown> };
    expect(background.paint['background-opacity']).toBe(0);
  });

  it('applique l’identité LKDV sans muter le style officiel', () => {
    const style = {
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#000' } }],
    } as unknown as StyleSpecification;
    const themed = applyLkdvIdentity(style);
    expect((themed.layers[0] as { paint: Record<string, unknown> }).paint['background-color']).toBe('#EFF2EA');
    expect((style.layers[0] as { paint: Record<string, unknown> }).paint['background-color']).toBe('#000');
  });

  it('conserve les sources officielles Maptoolkit dans le style final', () => {
    if (!official) {
      console.warn('fixture absente : test partiel');
      return;
    }
    const built = buildCartoStyle(official, { base: 'hybrid', terrain3d: true, arcgisKey: 'K' });
    // Licence : aucune source Maptoolkit réécrite.
    for (const [name, source] of Object.entries(official.sources)) {
      expect(built.sources[name], name).toEqual(source);
    }
    expect(built.glyphs).toBe(official.glyphs);
    expect(built.sprite).toEqual(official.sprite);
    // Les tuiles Maptoolkit restent sur leurs hôtes officiels.
    const mtk = built.sources.mtk as { url?: string; tiles?: string[] };
    const urls = [mtk.url, ...(mtk.tiles ?? [])].filter(Boolean) as string[];
    for (const url of urls) {
      expect(MAPTOOLKIT_HOSTS.some((host) => url.includes(host))).toBe(true);
    }
    // Terrain 3D et satellite présents, 133 couches officielles conservées.
    expect(built.terrain).toBeDefined();
    expect(built.layers.length).toBe(official.layers.length + 1);
    expect(built.layers.some((layer) => layer.id === 'lkdv-satellite-raster')).toBe(true);
  });

  it('génère un calque satellite masqué en mode standard pour bascule sans reconstruction', () => {
    if (!official) return;
    const built = buildCartoStyle(official, { base: 'maptoolkit', terrain3d: true, arcgisKey: 'K' });
    const satLayer = built.layers.find((layer) => layer.id === 'lkdv-satellite-raster');
    expect(satLayer).toBeDefined();
    expect((satLayer as { layout?: { visibility?: string } })?.layout?.visibility).toBe('none');
  });
});

describe('carto · débit Maptoolkit (TOS §9)', () => {
  it('réécrit les sources Maptoolkit vers le protocole throttlé, URLs officielles conservées', async () => {
    const { throttleStyleSources, throttleUrl, unthrottleUrl, isMaptoolkitUrl } = await import('@/features/carto/throttle');
    const style = {
      version: 8,
      sources: {
        mtk: { type: 'vector', url: 'https://tiles.maptoolkit.org/mtk-contours.json' },
        rocks: { type: 'raster', tiles: ['https://tiles.maptoolkit.org/v1/rocks/{z}/{x}/{y}.png'] },
        other: { type: 'raster', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'] },
      },
      layers: [],
    };
    const throttled = throttleStyleSources(style) as {
      sources: Record<string, { url?: string; tiles?: string[] }>;
    };
    expect(throttled.sources.mtk.url).toBe('lkdv-mtk://tiles.maptoolkit.org/mtk-contours.json');
    expect(throttled.sources.rocks.tiles?.[0]).toContain('lkdv-mtk://tiles.maptoolkit.org/');
    // Une source non-Maptoolkit n'est pas touchée.
    expect(throttled.sources.other.tiles?.[0]).toContain('https://s3.amazonaws.com/');
    // Aller-retour exact.
    expect(unthrottleUrl(throttleUrl('https://tiles.maptoolkit.org/x/1/2/3.mvt'))).toBe(
      'https://tiles.maptoolkit.org/x/1/2/3.mvt',
    );
    expect(isMaptoolkitUrl('https://fonts.maptoolkit.org/Noto/0-255.pbf')).toBe(true);
    expect(isMaptoolkitUrl('https://tiles.openfreemap.org/planet')).toBe(false);
  });
});
