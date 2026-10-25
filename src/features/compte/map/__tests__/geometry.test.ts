import { describe, expect, it } from 'vitest';
import { boundsOf, mergeBounds, parsePositions, simplifyTrack } from '../geometry';

describe('parsePositions', () => {
  it('lit une Feature LineString et ignore l’altitude', () => {
    const points = parsePositions({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.87, 45.92, 1200],
          [6.88, 45.93, 1300],
        ],
      },
    });
    expect(points).toEqual([
      { lng: 6.87, lat: 45.92 },
      { lng: 6.88, lat: 45.93 },
    ]);
  });

  it('lit un tableau de positions horodatées', () => {
    expect(
      parsePositions([
        { lat: 45.92, lng: 6.87, timestamp: '2026-10-01T08:00:00Z' },
        { lat: 999, lng: 6.88 },
      ])
    ).toEqual([{ lng: 6.87, lat: 45.92 }]);
  });

  it('rejette une géométrie vide ou non numérique', () => {
    expect(parsePositions(null)).toEqual([]);
    expect(parsePositions({ type: 'LineString', coordinates: [['x', 2]] })).toEqual([]);
  });
});

describe('simplifyTrack', () => {
  const line = Array.from({ length: 1000 }, (_, i) => ({
    lng: 6 + i * 0.0001,
    lat: 45 + Math.sin(i / 20) * 0.0002,
  }));

  it('conserve les extrémités et borne le nombre de points', () => {
    const out = simplifyTrack(line, 120);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out[0]).toEqual(line[0]);
    expect(out.at(-1)).toEqual(line.at(-1));
  });

  it('ne touche pas une trace déjà courte', () => {
    expect(simplifyTrack(line.slice(0, 2), 120)).toHaveLength(2);
  });
});

describe('boundsOf / mergeBounds', () => {
  it('calcule les bornes et fusionne', () => {
    const a = boundsOf([
      { lng: 6, lat: 45 },
      { lng: 7, lat: 46 },
    ]);
    const b = boundsOf([{ lng: 5, lat: 44 }]);
    expect(a).toEqual([6, 45, 7, 46]);
    expect(mergeBounds([a, b])).toEqual([5, 44, 7, 46]);
    expect(mergeBounds([null, null])).toBeNull();
  });
});
