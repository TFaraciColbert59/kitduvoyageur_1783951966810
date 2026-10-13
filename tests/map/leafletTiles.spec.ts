/**
 * Plan 1.6 : les cartes Leaflet utilisent les fonds autorisés en usage
 * commercial (ArcGIS avec la clé du site), avec leur crédit, comme la carte
 * MapLibre ; plus aucune URL publique en dur ailleurs que le repli sans clé.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arcgisTiles } from '@/components/map/engine/createMapStyle';
import { leafletTiles } from '@/components/map/engine/leafletTiles';
import { ALLOWED_TILE_HOSTS, OPENFREEMAP_HOST } from '@/components/map/engine/openFreeMap';

describe('fonds des cartes Leaflet', () => {
  it('avec la clé du site : ArcGIS, tuiles de 512 px décalées d’un zoom, « Powered by Esri »', () => {
    const topo = leafletTiles('topo', { key: 'cle-test' });
    expect(topo.url).toContain('static-map-tiles-api.arcgis.com');
    expect(topo.url).toContain('token=cle-test');
    expect(topo.options).toMatchObject({ tileSize: 512, zoomOffset: -1 });
    expect(topo.options.attribution).toContain('Powered by');
    expect(topo.options.attribution).toContain('OpenStreetMap');
  });

  it('imagerie satellite : tuiles de 256 px, sans décalage', () => {
    const sat = leafletTiles('satellite', { key: 'cle-test' });
    expect(sat.url).toContain('ibasemaps-api.arcgis.com');
    expect(sat.options).toMatchObject({ tileSize: 256, zoomOffset: 0 });
  });

  it('toutes les cartes, même petites : crédit complet, chaque fournisseur de données nommé', () => {
    // Leaflet n'a pas de crédit repliable : un crédit court oubliait TomTom, Garmin… (revue Codex, #83).
    const topo = leafletTiles('topo', { key: 'cle-test' }).options.attribution;
    for (const provider of ['Powered by', 'TomTom', 'Garmin', 'FAO', 'NOAA', 'USGS', 'OpenStreetMap', 'GIS User Community'])
      expect(topo).toContain(provider);
    expect(leafletTiles('satellite', { key: 'cle-test' }).options.attribution).toContain('Earthstar Geographics');
    expect(leafletTiles('osm', { key: 'cle-test' }).options.attribution).toContain('Esri Community Maps');
  });

  it('sans clé (développement) : un seul modèle {s} pour les sous-domaines', () => {
    const osm = leafletTiles('osm', { key: '' });
    expect(osm.url).toMatch(/^https:\/\/\{s\}\./);
    expect(osm.options.subdomains).toEqual(['a', 'b', 'c']);
  });
});

const FORBIDDEN = ['tile.openstreetmap.fr', 'tile.opentopomap.org', 'server.arcgisonline.com'];
/** Le seul endroit permis : le repli sans clé du moteur commun (développement, tests). */
const ALLOWED = new Set([join('src', 'components', 'map', 'engine', 'createMapStyle.ts')]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('aucune URL de fond non autorisée dans le code', () => {
  it('ni OSM France, ni OpenTopoMap, ni ArcGIS sans clé hors du repli de développement', () => {
    const offenders = sources('src')
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return FORBIDDEN.some((host) => text.includes(host));
      });
    expect(offenders).toEqual([]);
  });
});

/**
 * Plan 1.6 : trois hôtes de fonds de carte seulement, ArcGIS (clé du site) et OpenFreeMap (standard de la
 * carte MapLibre, sans clé). Les cartes Leaflet ne lisent pas les tuiles vectorielles d'OpenFreeMap :
 * elles gardent l'ArcGIS « standard ».
 */
describe('hôtes de fonds autorisés', () => {
  const hostOf = (url: string) => new URL(url.replace('{s}', 'a')).hostname;

  it('OpenFreeMap est dans la liste, avec les deux hôtes ArcGIS', () => {
    expect(ALLOWED_TILE_HOSTS).toContain('tiles.openfreemap.org');
    expect(OPENFREEMAP_HOST).toBe('tiles.openfreemap.org');
    expect([...ALLOWED_TILE_HOSTS].sort()).toEqual([
      'ibasemaps-api.arcgis.com',
      'static-map-tiles-api.arcgis.com',
      'tiles.openfreemap.org',
    ]);
  });

  it('chaque fond ArcGIS avec la clé du site sort sur un hôte de la liste', () => {
    const hosts = Object.values(arcgisTiles('cle-test'))
      .flatMap((t) => t.tiles)
      .map(hostOf);
    expect(hosts.length).toBeGreaterThan(0);
    for (const host of hosts) expect(ALLOWED_TILE_HOSTS as readonly string[]).toContain(host);
  });

  it('le CSP (connect-src de next.config.mjs) laisse passer chaque hôte de la liste', () => {
    const config = readFileSync('next.config.mjs', 'utf8');
    const connect = config.match(/"connect-src ([^"]+)"/)?.[1].split(/\s+/) ?? [];
    expect(connect.length).toBeGreaterThan(3);
    const allowed = (host: string) =>
      connect.some((src) => {
        if (src === `https://${host}`) return true;
        const wildcard = src.match(/^https:\/\/\*\.(.+)$/)?.[1];
        return wildcard !== undefined && host.endsWith(`.${wildcard}`);
      });
    for (const host of ALLOWED_TILE_HOSTS) expect(allowed(host), host).toBe(true);
  });

  it('l’adresse des tuiles d’OpenFreeMap n’est écrite que dans le moteur (openFreeMap.ts)', () => {
    const engine = join('src', 'components', 'map', 'engine', 'openFreeMap.ts');
    const offenders = sources('src')
      .filter((file) => file !== engine)
      .filter((file) => readFileSync(file, 'utf8').includes(OPENFREEMAP_HOST));
    expect(offenders).toEqual([]);
  });

  it('les cartes Leaflet restent sur ArcGIS, même pour le standard : jamais d’adresse OpenFreeMap', () => {
    for (const mode of ['topo', 'osm', 'satellite'] as const) {
      const spec = leafletTiles(mode, { key: 'cle-test' });
      expect(hostOf(spec.url), mode).toMatch(/arcgis\.com$/);
    }
    expect(readFileSync(join('src', 'components', 'map', 'engine', 'leafletTiles.ts'), 'utf8')).not.toMatch(/openfreemap/i);
  });
});
