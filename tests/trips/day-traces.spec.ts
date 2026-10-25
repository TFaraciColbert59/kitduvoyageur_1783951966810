import { describe, expect, it } from 'vitest';
import {
  dayTraceFromSteps,
  routeIdFromMetadata,
  sliceDayTrace,
  type DayTracePoint,
} from '@/features/trips/domain/dayTraces';

/** Polyligne de 7 sommets alignés (indices 0..6), pas régulier. */
const POLYLINE: DayTracePoint[] = Array.from({ length: 7 }, (_, i) => ({
  lat: 45 + i * 0.001,
  lng: 1 + i * 0.01,
}));

/** Polyligne de 10 sommets (indices 0..9), fractions non triviales. */
const POLYLINE_10: DayTracePoint[] = Array.from({ length: 10 }, (_, i) => ({
  lat: 44 + i * 0.001,
  lng: 2 + i * 0.01,
}));

describe('sliceDayTrace', () => {
  it('jours=1 → polyligne entière, bornes incluses', () => {
    const trace = sliceDayTrace(POLYLINE, 1, 1);
    expect(trace).toHaveLength(POLYLINE.length);
    expect(trace[0]).toBe(POLYLINE[0]);
    expect(trace[trace.length - 1]).toBe(POLYLINE[POLYLINE.length - 1]);
  });

  it('jours=2 sur 7 points → coupe à round((d/2)*6), J1 fin = J2 début', () => {
    const j1 = sliceDayTrace(POLYLINE, 1, 2);
    const j2 = sliceDayTrace(POLYLINE, 2, 2);

    expect(j1).toEqual(POLYLINE.slice(0, 4));
    expect(j2).toEqual(POLYLINE.slice(3, 7));
    expect(j1[0]).toBe(POLYLINE[0]);
    expect(j1[j1.length - 1]).toBe(j2[0]);
    expect(j2[j2.length - 1]).toBe(POLYLINE[6]);
  });

  it('jours=3 sur 7 points → segments exacts et contigus (fin Jn = début Jn+1)', () => {
    const j1 = sliceDayTrace(POLYLINE, 1, 3);
    const j2 = sliceDayTrace(POLYLINE, 2, 3);
    const j3 = sliceDayTrace(POLYLINE, 3, 3);

    expect(j1).toEqual(POLYLINE.slice(0, 3));
    expect(j2).toEqual(POLYLINE.slice(2, 5));
    expect(j3).toEqual(POLYLINE.slice(4, 7));
    expect(j1[j1.length - 1]).toBe(j2[0]);
    expect(j2[j2.length - 1]).toBe(j3[0]);
    expect(j3[j3.length - 1]).toBe(POLYLINE[6]);
  });

  it('jours=3 sur 10 points → fractions round(((d-1)/3)*9) → round((d/3)*9)', () => {
    expect(sliceDayTrace(POLYLINE_10, 1, 3)).toEqual(POLYLINE_10.slice(0, 4));
    expect(sliceDayTrace(POLYLINE_10, 2, 3)).toEqual(POLYLINE_10.slice(3, 7));
    expect(sliceDayTrace(POLYLINE_10, 3, 3)).toEqual(POLYLINE_10.slice(6, 10));
  });

  it('day > days → borne au dernier jour (comportement sûr, pas d’index hors bornes)', () => {
    expect(sliceDayTrace(POLYLINE, 5, 3)).toEqual(sliceDayTrace(POLYLINE, 3, 3));
    expect(sliceDayTrace(POLYLINE, 4, 3)).toEqual(sliceDayTrace(POLYLINE, 3, 3));
  });

  it('polyligne vide → []', () => {
    expect(sliceDayTrace([], 1, 3)).toEqual([]);
    expect(sliceDayTrace([], 2, 3)).toEqual([]);
  });

  it('polyligne à 1 point → ce point, quels que soient jour/jours', () => {
    const single = [{ lat: 45, lng: 1 }];
    expect(sliceDayTrace(single, 1, 1)).toEqual(single);
    expect(sliceDayTrace(single, 2, 3)).toEqual(single);
  });

  it('entrées invalides (jour/jours hors domaine) → []', () => {
    expect(sliceDayTrace(POLYLINE, 0, 3)).toEqual([]);
    expect(sliceDayTrace(POLYLINE, -1, 3)).toEqual([]);
    expect(sliceDayTrace(POLYLINE, 1, 0)).toEqual([]);
    expect(sliceDayTrace(POLYLINE, 1, -2)).toEqual([]);
    expect(sliceDayTrace(POLYLINE, Number.NaN, 3)).toEqual([]);
    expect(sliceDayTrace(POLYLINE, 1, Number.NaN)).toEqual([]);
  });

  it('coordonnées non finies ignorées', () => {
    const dirty = [
      POLYLINE[0],
      { lat: Number.NaN, lng: 1.01 },
      POLYLINE[2],
      { lat: 45.003, lng: Number.POSITIVE_INFINITY },
      POLYLINE[4],
    ];
    expect(sliceDayTrace(dirty, 1, 1)).toEqual([POLYLINE[0], POLYLINE[2], POLYLINE[4]]);
  });
});

describe('dayTraceFromSteps', () => {
  it('2+ étapes géolocalisées → coupe entre les sommets les plus proches', () => {
    const first = { lat: POLYLINE[1].lat + 0.0002, lng: POLYLINE[1].lng + 0.0002 };
    const last = { lat: POLYLINE[5].lat + 0.0002, lng: POLYLINE[5].lng + 0.0002 };
    const trace = dayTraceFromSteps([first, last], POLYLINE, 2, 3);

    expect(trace).toEqual(POLYLINE.slice(1, 6));
    expect(trace[0]).toBe(POLYLINE[1]);
    expect(trace[trace.length - 1]).toBe(POLYLINE[5]);
  });

  it('étapes inversées → segment normalisé min→max (jamais de slice vide)', () => {
    const trace = dayTraceFromSteps([POLYLINE[5], POLYLINE[1]], POLYLINE, 1, 2);
    expect(trace).toEqual(POLYLINE.slice(1, 6));
  });

  it('sommets exacts → indices des étapes', () => {
    const trace = dayTraceFromSteps([POLYLINE[2], POLYLINE[4]], POLYLINE, 1, 2);
    expect(trace).toEqual(POLYLINE.slice(2, 5));
  });

  it('repli sliceDayTrace si moins de 2 étapes géolocalisées', () => {
    const expected = sliceDayTrace(POLYLINE, 2, 3);
    expect(dayTraceFromSteps(undefined, POLYLINE, 2, 3)).toEqual(expected);
    expect(dayTraceFromSteps(null, POLYLINE, 2, 3)).toEqual(expected);
    expect(dayTraceFromSteps([], POLYLINE, 2, 3)).toEqual(expected);
    expect(dayTraceFromSteps([POLYLINE[3]], POLYLINE, 2, 3)).toEqual(expected);
  });

  it('repli sliceDayTrace si étapes invalides (NaN/Infinity) après filtrage', () => {
    const expected = sliceDayTrace(POLYLINE, 1, 2);
    const dirty = [
      { lat: Number.NaN, lng: 1 },
      { lat: 45, lng: Number.POSITIVE_INFINITY },
    ];
    expect(dayTraceFromSteps(dirty, POLYLINE, 1, 2)).toEqual(expected);
  });

  it('repli sliceDayTrace si polyligne < 2 points', () => {
    const single = [{ lat: 45, lng: 1 }];
    expect(dayTraceFromSteps([POLYLINE[0], POLYLINE[1]], single, 1, 2)).toEqual(single);
    expect(dayTraceFromSteps([POLYLINE[0], POLYLINE[1]], [], 1, 2)).toEqual([]);
  });

  it('étapes très loin de la polyligne → bornes aux extrémités, pas de hors-bornes', () => {
    const farA = { lat: 10, lng: -50 };
    const farB = { lat: -10, lng: 60 };
    const trace = dayTraceFromSteps([farA, farB], POLYLINE, 1, 2);
    expect(trace[0]).toBe(POLYLINE[0]);
    expect(trace[trace.length - 1]).toBe(POLYLINE[6]);
  });
});

describe('routeIdFromMetadata', () => {
  it('extrait un identifiant canonique depuis metadata.route_id', () => {
    expect(routeIdFromMetadata({ route_id: 42 })).toBe('42');
    expect(routeIdFromMetadata({ route_id: '17' })).toBe('17');
    expect(routeIdFromMetadata({ route_id: ' 8 ' })).toBe('8');
    expect(routeIdFromMetadata({ route_id: 3.9 })).toBe('3');
  });

  it('refuse les valeurs absentes ou non canoniques', () => {
    expect(routeIdFromMetadata(null)).toBeNull();
    expect(routeIdFromMetadata(undefined)).toBeNull();
    expect(routeIdFromMetadata({})).toBeNull();
    expect(routeIdFromMetadata({ route_id: 0 })).toBeNull();
    expect(routeIdFromMetadata({ route_id: -3 })).toBeNull();
    expect(routeIdFromMetadata({ route_id: 'abc' })).toBeNull();
    expect(routeIdFromMetadata({ route_id: '' })).toBeNull();
    expect(routeIdFromMetadata({ route_id: Number.NaN })).toBeNull();
    expect(routeIdFromMetadata({ route_id: {} })).toBeNull();
  });
});
