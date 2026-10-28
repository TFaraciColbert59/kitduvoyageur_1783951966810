import { describe, expect, it } from 'vitest';
import {
  capWaypoints,
  dedupeConsecutive,
  haversineM,
  pathLengthKm,
  replaceEndpoints,
  simplifyPath,
  type LonLat,
} from '../geometry';
import { dateOfDay, dayColor, dayCountFromDates, DAY_COLORS, toFeatureCollection, totalDistanceKm, type DayTrace } from '../days';

/** Ligne droite de `n` points, bruitée de ±5 m, sur ~3 km vers l'est. */
function noisyLine(n: number): LonLat[] {
  return Array.from({ length: n }, (_, i) => [6.0 + (i / (n - 1)) * 0.035, 45.0 + (i % 2 === 0 ? 0.00004 : -0.00004)] as LonLat);
}

describe('haversineM / pathLengthKm', () => {
  it('1° de latitude vaut ~111,2 km', () => {
    expect(Math.round(haversineM([0, 0], [0, 1]) / 1000)).toBe(111);
  });

  it('additionne les segments', () => {
    expect(pathLengthKm([[0, 0], [0, 1], [0, 2]])).toBeCloseTo(222.4, 0);
    expect(pathLengthKm([[0, 0]])).toBe(0);
  });
});

describe('simplifyPath', () => {
  it('réduit une ligne droite bruitée à ses extrémités', () => {
    const out = simplifyPath(noisyLine(200), 15);
    expect(out).toHaveLength(2);
  });

  it('garde un virage net', () => {
    const corner: LonLat[] = [[6.0, 45.0], [6.01, 45.0], [6.02, 45.0], [6.02, 45.01], [6.02, 45.02]];
    const out = simplifyPath(corner, 15);
    expect(out).toContainEqual([6.02, 45.0]);
    expect(out[0]).toEqual([6.0, 45.0]);
    expect(out[out.length - 1]).toEqual([6.02, 45.02]);
  });

  it('ne touche pas un tracé de 2 points', () => {
    expect(simplifyPath([[0, 0], [1, 1]], 10)).toEqual([[0, 0], [1, 1]]);
  });
});

describe('capWaypoints', () => {
  it('tient en 12 points même pour un zigzag de 500 points', () => {
    const zigzag: LonLat[] = Array.from({ length: 500 }, (_, i) => [6 + i * 0.0002, 45 + Math.sin(i / 7) * 0.01] as LonLat);
    const out = capWaypoints(zigzag, 12);
    expect(out.length).toBeLessThanOrEqual(12);
    expect(out[0]).toEqual(zigzag[0]);
    expect(out[out.length - 1]).toEqual(zigzag[zigzag.length - 1]);
  });

  it('refuse un maximum inférieur à 2', () => {
    expect(() => capWaypoints([[0, 0], [1, 1]], 1)).toThrow(RangeError);
  });

  it('garde l’ordre des points', () => {
    const out = capWaypoints(noisyLine(300), 5, 1);
    for (let i = 1; i < out.length; i++) expect((out[i] as LonLat)[0]).toBeGreaterThan((out[i - 1] as LonLat)[0]);
  });
});

describe('dedupeConsecutive / replaceEndpoints', () => {
  it('retire les points confondus', () => {
    expect(dedupeConsecutive([[6, 45], [6, 45], [6.0001, 45], [6.0001, 45]], 1)).toHaveLength(2);
  });

  it('refixe départ et arrivée sans toucher au milieu', () => {
    const out = replaceEndpoints([[0, 0], [1, 1], [2, 2]], { start: [0.1, 0.1], end: [2.1, 2.1] });
    expect(out).toEqual([[0.1, 0.1], [1, 1], [2.1, 2.1]]);
  });

  it('crée un tracé à partir d’adresses seules', () => {
    expect(replaceEndpoints([], { start: [1, 1], end: [2, 2] })).toEqual([[1, 1], [2, 2]]);
  });
});

describe('jours', () => {
  it('compte les jours inclus, borné', () => {
    expect(dayCountFromDates('2026-07-01', '2026-07-03')).toBe(3);
    expect(dayCountFromDates('2026-07-01', '2026-07-01')).toBe(1);
    expect(dayCountFromDates('2026-07-05', '2026-07-01')).toBe(1);
    expect(dayCountFromDates('', '2026-07-01')).toBe(1);
    expect(dayCountFromDates('2026-01-01', '2027-01-01')).toBe(30);
  });

  it('date du jour n', () => {
    expect(dateOfDay('2026-07-01', 3)).toBe('2026-07-03');
    expect(dateOfDay(null, 1)).toBeNull();
  });

  it('cycle les couleurs de jours', () => {
    expect(dayColor(1)).toBe(DAY_COLORS[0]);
    expect(dayColor(DAY_COLORS.length + 1)).toBe(DAY_COLORS[0]);
    expect(dayColor(0)).toBe(DAY_COLORS[DAY_COLORS.length - 1]);
  });
});

describe('toFeatureCollection', () => {
  const day = (n: number, coords: LonLat[]): DayTrace => ({ day: n, coords, waypoints: coords, snapped: true, distanceKm: pathLengthKm(coords) });

  it('une ligne et deux bornes par jour tracé, dans l’ordre des jours', () => {
    const fc = toFeatureCollection([day(2, [[6.1, 45.1], [6.2, 45.2]]), day(1, [[6, 45], [6.1, 45.1]])]);
    expect(fc.features.map((f) => `${f.properties.kind}${f.properties.day}`)).toEqual([
      'day1', 'boundary1', 'boundary1', 'day2', 'boundary2', 'boundary2',
    ]);
    const boundaries = fc.features.filter((f) => f.properties.kind === 'boundary');
    expect(boundaries[0]?.geometry.coordinates).toEqual([6, 45]);
  });

  it('ignore un jour sans tracé', () => {
    expect(toFeatureCollection([day(1, [[6, 45]])]).features).toHaveLength(0);
  });

  it('additionne les distances', () => {
    expect(totalDistanceKm([day(1, [[0, 0], [0, 1]]), day(2, [[0, 1], [0, 2]])])).toBeCloseTo(222.4, 0);
  });
});

import { mergeDayTraces, parseDayTraceRows } from '../parse';

describe('parseDayTraceRows', () => {
  const row = (jour: number | null, coords: unknown, extra: Record<string, unknown> = {}) => ({
    jour_numero: jour,
    coords,
    waypoints: coords,
    snapped: true,
    distance_km: '4.20',
    end_label: ' Refuge ',
    ...extra,
  });

  it('lit, trie par jour et nettoie le libellé', () => {
    const out = parseDayTraceRows([row(2, [[6.1, 45.1], [6.2, 45.2]]), row(1, [[6, 45], [6.1, 45.1]])]);
    expect(out.map((d) => d.day)).toEqual([1, 2]);
    expect(out[0]).toMatchObject({ snapped: true, distanceKm: 4.2, endLabel: 'Refuge' });
  });

  it('écarte les lignes mal formées sans lever', () => {
    const out = parseDayTraceRows([
      row(0, [[6, 45], [6.1, 45.1]]),
      row(31, [[6, 45], [6.1, 45.1]]),
      row(1, 'pas un tableau'),
      row(2, [[6, 45]]),
      row(3, [[999, 45], [6, 45]]),
      row(4, [[6, 45], [6.1, 45.1]]),
    ]);
    expect(out.map((d) => d.day)).toEqual([4]);
  });

  it('une distance invalide vaut 0, pas NaN', () => {
    expect(parseDayTraceRows([row(1, [[6, 45], [6.1, 45.1]], { distance_km: 'abc' })])[0]?.distanceKm).toBe(0);
  });

  it('tolère null et undefined', () => {
    expect(parseDayTraceRows(null)).toEqual([]);
    expect(parseDayTraceRows(undefined)).toEqual([]);
  });
});

describe('mergeDayTraces', () => {
  it('met les jours bout à bout', () => {
    const days = parseDayTraceRows([
      { jour_numero: 1, coords: [[6, 45], [6.1, 45.1]], snapped: true, distance_km: 1 },
      { jour_numero: 2, coords: [[6.1, 45.1], [6.2, 45.2]], snapped: true, distance_km: 1 },
    ]);
    expect(mergeDayTraces(days)?.coordinates).toHaveLength(4);
  });

  it('null sans tracé', () => {
    expect(mergeDayTraces([])).toBeNull();
  });
});
