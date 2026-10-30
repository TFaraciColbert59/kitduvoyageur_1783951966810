import { describe, expect, it } from 'vitest';
import {
  elevationGain,
  formatDistance,
  haversineKm,
  joinLines,
  joinSegments,
  lengthKm,
  pickWaypoints,
  removeSpurs,
  sampleAlong,
  simplify,
  smooth,
  type LngLat,
} from '../traceEngine';

const line = (n: number, start: LngLat = [6, 45], step = 0.001): LngLat[] =>
  Array.from({ length: n }, (_, i) => [start[0] + i * step, start[1]] as LngLat);

describe('traceEngine — distance', () => {
  it('mesure un degré de latitude à ~111 km', () => {
    expect(haversineKm([6, 45], [6, 46])).toBeCloseTo(111.2, 0);
  });
  it('additionne les tronçons', () => {
    expect(lengthKm(line(11))).toBeCloseTo(haversineKm([6, 45], [6.01, 45]), 6);
  });
  it('formate en mètres puis en kilomètres', () => {
    expect(formatDistance(0.42)).toBe('420 m');
    expect(formatDistance(12.44)).toBe('12,4 km');
    expect(formatDistance(128.6)).toBe('129 km');
    expect(formatDistance(0)).toBe('0 km');
  });
});

describe('traceEngine — jonctions', () => {
  it('ne duplique pas le point commun', () => {
    expect(joinLines([[6, 45], [6.1, 45]], [[6.1, 45], [6.2, 45]])).toHaveLength(3);
  });
  it('écarte les points invalides et borne la taille', () => {
    const bad = [[6, 45], [Number.NaN, 45], [200, 45], [6.1, 45]] as LngLat[];
    expect(joinSegments([bad])).toEqual([[6, 45], [6.1, 45]]);
    expect(joinSegments([line(50)], 10)).toHaveLength(10);
  });
});

describe('traceEngine — points de passage', () => {
  it('garde les extrémités et réduit une ligne droite à deux points', () => {
    const pts = line(40);
    expect(simplify(pts, 1e-6)).toEqual([pts[0], pts[39]]);
  });
  it('ne dépasse jamais le maximum demandé par le routeur', () => {
    const zigzag = Array.from({ length: 200 }, (_, i) => [6 + i * 0.001, 45 + (i % 2) * 0.002] as LngLat);
    const picked = pickWaypoints(zigzag, 12, 1e-5);
    expect(picked.length).toBeLessThanOrEqual(12);
    expect(picked[0]).toEqual(zigzag[0]);
    expect(picked[picked.length - 1]).toEqual(zigzag[199]);
  });
});

describe('traceEngine — nettoyage du routage', () => {
  it('retire un aller-retour vers un point de passage hors chemin', () => {
    const a: LngLat = [6, 45];
    const b: LngLat = [6.001, 45];
    const spike: LngLat = [6.001, 45.0008];
    const c: LngLat = [6.002, 45];
    expect(removeSpurs([a, b, spike, [6.001, 45.00001], c])).toEqual([a, b, c]);
  });
  it('laisse intact un tracé sans retour', () => {
    const pts = line(6);
    expect(removeSpurs(pts)).toEqual(pts);
  });
  it('lisse un tracé libre sans bouger les extrémités', () => {
    const pts: LngLat[] = [[6, 45], [6.01, 45.01], [6.02, 45]];
    const out = smooth(pts);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[2]);
    expect(out.length).toBeGreaterThan(pts.length);
  });
});

describe('traceEngine — dénivelé', () => {
  it('répartit les échantillons à distance égale', () => {
    const out = sampleAlong(line(11), 6);
    expect(out).toHaveLength(6);
    expect(out[2][0]).toBeCloseTo(6.004, 6);
  });
  it('ignore le bruit sous le seuil et compte les vraies montées', () => {
    expect(elevationGain([1000, 1002, 999, 1001, 1000])).toEqual({ gain: 0, loss: 0 });
    expect(elevationGain([1000, 1100, 1050, 1300, null, 1200])).toEqual({ gain: 350, loss: 150 });
  });
});
