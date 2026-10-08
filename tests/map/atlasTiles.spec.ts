import { describe, expect, it } from 'vitest';
import { arcgisTiles, atlasTiles, createMapStyle } from '@/components/map/engine/createMapStyle';

/**
 * Plan 1.6 (8 octobre) : les fonds de carte passent par ArcGIS Location
 * Platform (offre gratuite, usage commercial autorisé avec une clé) dès que
 * la clé du déploiement existe. « Powered by Esri » est obligatoire.
 */
describe('fonds de carte autorisés en commercial', () => {
  it('avec la clé : tuiles ArcGIS signées, aucune source publique non commerciale', () => {
    const tiles = atlasTiles('cle-publique');
    const urls = Object.values(tiles).flatMap((t) => t.tiles);
    expect(urls.every((u) => u.includes('token=cle-publique'))).toBe(true);
    expect(urls.some((u) => /arcgisonline\.com|openstreetmap\.fr|opentopomap/.test(u))).toBe(false);
    expect(tiles.topo.tiles[0]).toContain('/arcgis/outdoor/static/tile/{z}/{y}/{x}');
    expect(tiles.osm.tiles[0]).toContain('/open/osm-style/static/tile/{z}/{y}/{x}');
    expect(tiles.satellite.tiles[0]).toContain('ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    // Tuiles statiques ArcGIS en 512 px, imagerie en 256 px.
    expect([tiles.topo.tileSize, tiles.osm.tileSize, tiles.satellite.tileSize]).toEqual([512, 512, 256]);
    for (const t of Object.values(tiles)) {
      expect(t.attribution).toContain('Powered by');
      expect(t.short).toContain('Powered by Esri');
      // Mention complète des fournisseurs, dépliable depuis la pastille (revue Codex).
      expect(t.credits).toMatch(/^Powered by Esri · /);
    }
    expect(tiles.topo.credits).toContain('TomTom, Garmin, FAO, NOAA, USGS');
    expect(tiles.satellite.credits).toContain('Maxar, Earthstar Geographics');
  });

  it('la clé est encodée dans l’adresse (jamais d’URL cassée)', () => {
    expect(arcgisTiles('a b&c').topo.tiles[0]).toContain('token=a%20b%26c');
  });

  it('sans clé : les fonds publics d’avant (développement, tests)', () => {
    expect(atlasTiles('').topo.tiles[0]).toContain('server.arcgisonline.com');
    expect(atlasTiles(undefined).osm.tileSize).toBe(256);
  });

  it('le style MapLibre reprend la taille de tuile de chaque fond', () => {
    const style = createMapStyle('topo');
    const sizes = Object.values(style.sources).map((s) => (s as { tileSize?: number }).tileSize);
    expect(sizes.every((n) => n === 256 || n === 512)).toBe(true);
  });
});
