/**
 * Plan 1.6 : les cartes Leaflet utilisent les fonds autorisés en usage
 * commercial (ArcGIS avec la clé du site), avec leur crédit, comme la carte
 * MapLibre ; plus aucune URL publique en dur ailleurs que le repli sans clé.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { leafletTiles } from '@/components/map/engine/leafletTiles';

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

  it('petites cartes : crédit court, mais toujours Esri et OpenStreetMap', () => {
    const osm = leafletTiles('osm', { key: 'cle-test', compact: true });
    expect(osm.options.attribution).toBe('Powered by Esri · © OpenStreetMap');
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
