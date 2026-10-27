import { describe, expect, it } from 'vitest';
import { MAP_ZOOM_PRIORITY, resolveMapZoomConfig } from '../zoomHierarchy';

describe('resolveMapZoomConfig', () => {
  it('classe les quatre bandes aux seuils exacts', () => {
    expect(resolveMapZoomConfig(4.49).band).toBe('world');
    expect(resolveMapZoomConfig(4.5).band).toBe('country');
    expect(resolveMapZoomConfig(6.49).band).toBe('country');
    expect(resolveMapZoomConfig(6.5).band).toBe('region');
    expect(resolveMapZoomConfig(9.99).band).toBe('region');
    expect(resolveMapZoomConfig(10).band).toBe('place');
  });

  it('garde des tailles fixes par bande', () => {
    expect(resolveMapZoomConfig(3).trackWidth).toBe(1.5);
    expect(resolveMapZoomConfig(5).trackWidth).toBe(2);
    expect(resolveMapZoomConfig(8).trackWidth).toBe(3.5);
    expect(resolveMapZoomConfig(12).trackWidth).toBe(4);
  });

  it('masque les POI hors de la bande lieu', () => {
    expect(resolveMapZoomConfig(3).pois).toBe('hidden');
    expect(resolveMapZoomConfig(8).pois).toBe('hidden');
    expect(resolveMapZoomConfig(12).pois).toBe('pills');
  });

  it('expose la visibilité de chaque couche par bande', () => {
    const world = resolveMapZoomConfig(3);
    expect(world.massifs).toBe('clustered');
    expect(world.carnets).toBe('hidden');
    expect(world.endpoints).toBe('hidden');
    expect(world.trackSimplified).toBe(true);
    expect(world.casing).toBe(false);
    expect(world.glow).toBe(false);

    const country = resolveMapZoomConfig(5);
    expect(country.massifs).toBe('clustered');
    expect(country.carnets).toBe('hidden');
    expect(country.endpoints).toBe('hidden');

    const region = resolveMapZoomConfig(8);
    expect(region.massifs).toBe('individual');
    expect(region.carnets).toBe('dots');
    expect(region.endpoints).toBe('dots');
    expect(region.trackSimplified).toBe(false);
    expect(region.casing).toBe(true);
    expect(region.glow).toBe(true);

    const place = resolveMapZoomConfig(12);
    expect(place.massifs).toBe('individual');
    expect(place.carnets).toBe('pills');
    expect(place.endpoints).toBe('dots');
  });

  it('garde une taille de point stable dans une même bande', () => {
    // Aucune taille ne doit grossir au dézoom : à bande égale, largeur égale.
    expect(resolveMapZoomConfig(6.5).trackWidth).toBe(resolveMapZoomConfig(9.99).trackWidth);
    expect(resolveMapZoomConfig(10).trackWidth).toBe(resolveMapZoomConfig(16).trackWidth);
    expect(resolveMapZoomConfig(0).trackWidth).toBe(resolveMapZoomConfig(4.49).trackWidth);
  });

  it('applique la priorité d’empilement documentée', () => {
    expect(MAP_ZOOM_PRIORITY).toEqual(['selected', 'poi', 'carnet', 'massif', 'endpoint', 'track']);
  });
});
