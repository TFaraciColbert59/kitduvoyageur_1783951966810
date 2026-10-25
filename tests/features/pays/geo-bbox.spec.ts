import { describe, it, expect } from 'vitest';
import { computeGeometryBbox } from '@/features/pays/mappers/geoBbox';

describe('computeGeometryBbox', () => {
  it('calcule la bbox d’un Polygon', () => {
    const bbox = computeGeometryBbox({
      type: 'Polygon',
      coordinates: [
        [
          [-18, 64],
          [-17, 64],
          [-17, 65],
          [-18, 65],
          [-18, 64],
        ],
      ],
    });
    expect(bbox).toEqual({ minLat: 64, maxLat: 65, minLng: -18, maxLng: -17 });
  });

  it('gère un Feature et une GeometryCollection', () => {
    expect(
      computeGeometryBbox({ type: 'Feature', geometry: { type: 'Point', coordinates: [2, 46] } })
    ).toEqual({ minLat: 46, maxLat: 46, minLng: 2, maxLng: 2 });

    expect(
      computeGeometryBbox({
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [0, 0] },
          { type: 'Point', coordinates: [10, 20] },
        ],
      })
    ).toEqual({ minLat: 0, maxLat: 20, minLng: 0, maxLng: 10 });
  });

  it('accepte une géométrie encodée en chaîne JSON', () => {
    const bbox = computeGeometryBbox(JSON.stringify({ type: 'Point', coordinates: [2, 46] }));
    expect(bbox?.minLat).toBe(46);
  });

  it('retourne null si non exploitable', () => {
    expect(computeGeometryBbox(null)).toBeNull();
    expect(computeGeometryBbox('not-json')).toBeNull();
    expect(computeGeometryBbox({ type: 'Point', coordinates: ['a', 'b'] })).toBeNull();
  });
});
