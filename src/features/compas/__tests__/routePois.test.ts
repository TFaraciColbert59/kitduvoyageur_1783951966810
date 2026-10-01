import { describe, expect, it } from 'vitest';
import { countByCategory, parseRoutePois, poiLabel } from '../engine/routePois';

describe('parseRoutePois', () => {
  it('lit les lignes valides et écarte le reste', () => {
    const pois = parseRoutePois([
      {
        id: 1,
        name: ' Source du col ',
        category: 'water',
        lat: 45.1,
        lon: 6.2,
        distance_m: 120.4,
        elevation_m: '1850',
      },
      {
        id: 2,
        name: null,
        category: 'refuge',
        lat: 45.2,
        lon: 6.3,
        distance_m: 40,
        elevation_m: null,
      },
      { id: 3, name: 'x', category: 'banc', lat: 45, lon: 6, distance_m: 1 },
      { id: 4, name: 'y', category: 'peak', lat: 200, lon: 6, distance_m: 1 },
      { id: 'a', name: 'z', category: 'peak', lat: 45, lon: 6, distance_m: 1 },
    ]);
    expect(pois.map((p) => p.id)).toEqual([1, 2]);
    expect(pois[0]).toMatchObject({ name: 'Source du col', distanceM: 120, elevationM: 1850 });
    expect(pois[1].elevationM).toBeNull();
  });

  it('un point sans nom garde sa catégorie, jamais un nom inventé', () => {
    const [p] = parseRoutePois([
      { id: 2, name: '  ', category: 'water', lat: 45, lon: 6, distance_m: 5 },
    ]);
    expect(p.name).toBeNull();
    expect(poiLabel(p)).toBe('Point d’eau');
  });

  it('entrée non tableau → vide ; comptage par catégorie', () => {
    expect(parseRoutePois(null)).toEqual([]);
    const pois = parseRoutePois([
      { id: 1, category: 'water', lat: 1, lon: 1 },
      { id: 2, category: 'water', lat: 1, lon: 1 },
      { id: 3, category: 'peak', lat: 1, lon: 1 },
    ]);
    expect(countByCategory(pois)).toMatchObject({ water: 2, peak: 1, refuge: 0 });
  });
});
