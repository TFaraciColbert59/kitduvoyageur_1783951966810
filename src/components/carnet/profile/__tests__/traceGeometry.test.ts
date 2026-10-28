import { describe, expect, it } from 'vitest';
import { boundsOf, extractCoords, haversineKm, projectToViewBox, traceCenter, traceLengthKm } from '../traceGeometry';

const LINE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.87, 45.84],
  ],
};

describe('traceGeometry — mini tracé et recentrage', () => {
  it('lit une LineString GeoJSON en [lat, lng]', () => {
    expect(extractCoords(LINE)).toEqual([
      [45.83, 6.86],
      [45.84, 6.87],
    ]);
  });

  it('lit aussi une liste de points {lat, lng}', () => {
    expect(extractCoords([{ lat: 45.9, lng: 6.9 }])).toEqual([[45.9, 6.9]]);
  });

  it('ignore les points non finis et les traces absentes', () => {
    expect(extractCoords(null)).toEqual([]);
    expect(extractCoords({ coordinates: [[null, 1], 'x'] })).toEqual([]);
  });

  it('projette la trace dans un viewBox 66 sans sortir du cadre', () => {
    const points = projectToViewBox(extractCoords(LINE), 66, 9);
    const coords = points.split(' ').map((pair) => pair.split(',').map(Number));
    expect(coords).toHaveLength(2);
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(66);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(66);
    }
  });

  it('ne rend rien pour une trace vide', () => {
    expect(projectToViewBox([], 66, 9)).toBe('');
    expect(boundsOf([])).toBeNull();
    expect(traceCenter([])).toBeNull();
  });

  it('centre un point unique au milieu du carré', () => {
    expect(projectToViewBox([[45.9, 6.9]], 66, 9)).toBe('33.00,33.00');
  });

  it('donne le centre réel du parcours', () => {
    const center = traceCenter(extractCoords(LINE));
    expect(center?.lat).toBeCloseTo(45.835, 6);
    expect(center?.lng).toBeCloseTo(6.865, 6);
  });
});

describe('traceGeometry — longueur réelle de la trace', () => {
  it('mesure la distance entre deux points réels', () => {
    /* 0,01° de latitude ≈ 1,11 km. */
    expect(haversineKm([45.83, 6.86], [45.84, 6.86])).toBeCloseTo(1.112, 2);
  });

  it('cumule les segments de la trace, jamais une valeur inventée', () => {
    const length = traceLengthKm(LINE);
    expect(length).not.toBeNull();
    expect(length as number).toBeGreaterThan(1.1);
    expect(length as number).toBeLessThan(1.6);
    expect(traceLengthKm({ type: 'LineString', coordinates: [] })).toBeNull();
    expect(traceLengthKm(null)).toBeNull();
    expect(traceLengthKm({ coordinates: [[6.86, 45.83]] })).toBeNull();
  });
});
