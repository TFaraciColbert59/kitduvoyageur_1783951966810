import { describe, expect, it } from 'vitest';
import {
  projectShareableTrace,
  type PrivacyZone,
  type TraceMask,
  type TracePoint,
} from '../traceProjection';

const EARTH_RADIUS_M = 6_371_008.8;

/** Coordonnées synthétiques : ligne d'équateur, aucun lieu réel. */
function line(count: number, step = 0.001): TracePoint[] {
  return Array.from({ length: count }, (_, index) => ({
    lng: index * step,
    lat: 0,
  }));
}

function distanceM(a: TracePoint, b: TracePoint): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function strictlyInside(zone: PrivacyZone, point: TracePoint): boolean {
  if (zone.kind === 'circle') {
    return distanceM(zone.center, point) < zone.radiusM - 0.5;
  }
  const [west, south, east, north] = zone.bounds;
  const epsilon = 1e-9;
  return (
    point.lng > west + epsilon &&
    point.lng < east - epsilon &&
    point.lat > south + epsilon &&
    point.lat < north - epsilon
  );
}

function expectNoPointInside(zone: PrivacyZone, segments: TracePoint[][]): void {
  for (const point of segments.flat()) {
    expect(strictlyInside(zone, point)).toBe(false);
  }
}

describe('projectShareableTrace — absence de masque', () => {
  it('rend la trace intacte, en un seul segment', () => {
    const points = line(5);
    const result = projectShareableTrace(points);

    expect(result.error).toBeNull();
    expect(result.masked).toBe(false);
    expect(result.fullyMasked).toBe(false);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toEqual(points);
    expect(result.inputPointCount).toBe(5);
    expect(result.visiblePointCount).toBe(5);
  });

  it('traite un tableau de masques vide comme une absence de masque', () => {
    const points = line(3);
    const result = projectShareableTrace(points, []);

    expect(result.error).toBeNull();
    expect(result.masked).toBe(false);
    expect(result.segments).toEqual([points]);
  });

  it('ne modifie jamais les points fournis', () => {
    const points = line(4);
    const snapshot = points.map((point) => ({ ...point }));

    projectShareableTrace(points, [
      { kind: 'start', meters: 120 },
      { kind: 'zone', zone: { kind: 'circle', center: { lng: 0.002, lat: 0 }, radiusM: 70 } },
    ]);

    expect(points).toEqual(snapshot);
  });
});

describe('projectShareableTrace — masques début et fin', () => {
  it('coupe le début au mètre demandé', () => {
    const points = line(11);
    const result = projectShareableTrace(points, [{ kind: 'start', meters: 250 }]);

    expect(result.error).toBeNull();
    expect(result.segments).toHaveLength(1);
    const visible = result.segments[0];
    expect(distanceM(points[0], visible[0])).toBeGreaterThan(249);
    expect(distanceM(points[0], visible[0])).toBeLessThan(251);
    expect(visible.at(-1)).toEqual(points.at(-1));
  });

  it('coupe la fin au mètre demandé', () => {
    const points = line(11);
    const result = projectShareableTrace(points, [{ kind: 'end', meters: 250 }]);

    expect(result.error).toBeNull();
    expect(result.segments).toHaveLength(1);
    const visible = result.segments[0];
    expect(visible[0]).toEqual(points[0]);
    expect(distanceM(visible.at(-1) as TracePoint, points.at(-1) as TracePoint)).toBeGreaterThan(
      249
    );
    expect(distanceM(visible.at(-1) as TracePoint, points.at(-1) as TracePoint)).toBeLessThan(251);
  });

  it('cumule début et fin en conservant un seul segment central', () => {
    const points = line(11);
    const result = projectShareableTrace(points, [
      { kind: 'start', meters: 250 },
      { kind: 'end', meters: 250 },
    ]);

    expect(result.error).toBeNull();
    expect(result.segments).toHaveLength(1);
    const visible = result.segments[0];
    expect(distanceM(points[0], visible[0])).toBeGreaterThan(249);
    expect(distanceM(points[0], visible[0])).toBeLessThan(251);
    expect(distanceM(visible.at(-1) as TracePoint, points.at(-1) as TracePoint)).toBeGreaterThan(
      249
    );
    expect(distanceM(visible.at(-1) as TracePoint, points.at(-1) as TracePoint)).toBeLessThan(251);
  });

  it('ne fabrique aucun segment quand les deux masques se recouvrent', () => {
    const points = line(11);
    const result = projectShareableTrace(points, [
      { kind: 'start', meters: 700 },
      { kind: 'end', meters: 700 },
    ]);

    expect(result.error).toBeNull();
    expect(result.masked).toBe(true);
    expect(result.fullyMasked).toBe(true);
    expect(result.segments).toEqual([]);
  });

  it('masque la totalité de la trace', () => {
    const points = line(11);
    const result = projectShareableTrace(points, [{ kind: 'all' }]);

    expect(result.error).toBeNull();
    expect(result.masked).toBe(true);
    expect(result.fullyMasked).toBe(true);
    expect(result.segments).toEqual([]);
  });

  it('un masque de zéro mètre ne retire rien', () => {
    const points = line(4);
    const result = projectShareableTrace(points, [{ kind: 'start', meters: 0 }]);

    expect(result.error).toBeNull();
    expect(result.segments).toEqual([points]);
  });
});

describe('projectShareableTrace — zone géographique', () => {
  const circle: PrivacyZone = {
    kind: 'circle',
    center: { lng: 0.005, lat: 0 },
    radiusM: 150,
  };

  it('découpe un segment qui traverse un cercle sans sommet intérieur', () => {
    const points: TracePoint[] = [
      { lng: 0, lat: 0 },
      { lng: 0.01, lat: 0 },
    ];
    const result = projectShareableTrace(points, [{ kind: 'zone', zone: circle }]);

    expect(result.error).toBeNull();
    expect(result.segments).toHaveLength(2);
    const [before, after] = result.segments;
    expect(before.at(-1)!.lng).toBeLessThan(0.005);
    expect(after[0].lng).toBeGreaterThan(0.005);
    expect(distanceM(circle.center, before.at(-1)!)).toBeCloseTo(150, 0);
    expect(distanceM(circle.center, after[0])).toBeCloseTo(150, 0);
    expectNoPointInside(circle, result.segments);
  });

  it('découpe une polyligne qui traverse une boîte géographique', () => {
    const zone: PrivacyZone = {
      kind: 'bbox',
      bounds: [0.0035, -0.001, 0.0065, 0.001],
    };
    const points = line(11);
    const result = projectShareableTrace(points, [{ kind: 'zone', zone }]);

    expect(result.error).toBeNull();
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].at(-1)!.lng).toBeCloseTo(0.0035, 6);
    expect(result.segments[1][0].lng).toBeCloseTo(0.0065, 6);
    expectNoPointInside(zone, result.segments);
  });

  it('préserve deux coupures distinctes et leur ordre', () => {
    const points = line(11);
    const result = projectShareableTrace(points, [
      {
        kind: 'zone',
        zone: { kind: 'circle', center: { lng: 0.003, lat: 0 }, radiusM: 80 },
      },
      {
        kind: 'zone',
        zone: { kind: 'circle', center: { lng: 0.007, lat: 0 }, radiusM: 80 },
      },
    ]);

    expect(result.error).toBeNull();
    expect(result.segments).toHaveLength(3);
    const [first, middle, last] = result.segments;
    expect(first.at(-1)!.lng).toBeLessThan(0.003);
    expect(middle[0].lng).toBeGreaterThan(0.003);
    expect(middle.at(-1)!.lng).toBeLessThan(0.007);
    expect(last[0].lng).toBeGreaterThan(0.007);
    expect(first.at(-1)!.lng).toBeLessThan(middle[0].lng);
    expect(middle.at(-1)!.lng).toBeLessThan(last[0].lng);
  });

  it('coupe aussi une zone qui couvre le début de la trace', () => {
    const points = line(11);
    const zone: PrivacyZone = {
      kind: 'circle',
      center: { lng: 0, lat: 0 },
      radiusM: 250,
    };
    const result = projectShareableTrace(points, [{ kind: 'zone', zone }]);

    expect(result.error).toBeNull();
    expect(result.segments).toHaveLength(1);
    const visible = result.segments[0];
    expect(distanceM(points[0], visible[0])).toBeGreaterThan(249);
    expect(distanceM(points[0], visible[0])).toBeLessThan(251);
    expect(visible.at(-1)).toEqual(points.at(-1));
    expectNoPointInside(zone, result.segments);
  });

  it('masque toute la trace quand la zone la contient entièrement', () => {
    const points = line(3);
    const zone: PrivacyZone = {
      kind: 'circle',
      center: { lng: 0.001, lat: 0 },
      radiusM: 10_000,
    };
    const result = projectShareableTrace(points, [{ kind: 'zone', zone }]);

    expect(result.error).toBeNull();
    expect(result.masked).toBe(true);
    expect(result.fullyMasked).toBe(true);
    expect(result.segments).toEqual([]);
  });
});

describe('projectShareableTrace — masques cumulés', () => {
  it('combine début, fin et zone sans reconnecter les morceaux', () => {
    const points = line(11);
    const zone: PrivacyZone = {
      kind: 'circle',
      center: { lng: 0.005, lat: 0 },
      radiusM: 100,
    };
    const masks: TraceMask[] = [
      { kind: 'start', meters: 150 },
      { kind: 'end', meters: 150 },
      { kind: 'zone', zone },
    ];
    const result = projectShareableTrace(points, masks);

    expect(result.error).toBeNull();
    expect(result.segments).toHaveLength(2);
    const [before, after] = result.segments;
    expect(distanceM(points[0], before[0])).toBeGreaterThan(149);
    expect(distanceM(points[0], before[0])).toBeLessThan(151);
    expect(distanceM(before.at(-1)!, zone.center)).toBeCloseTo(100, 0);
    expect(distanceM(after[0], zone.center)).toBeCloseTo(100, 0);
    expect(distanceM(after.at(-1)!, points.at(-1)!)).toBeGreaterThan(149);
    expect(distanceM(after.at(-1)!, points.at(-1)!)).toBeLessThan(151);
    expect(before.at(-1)!.lng).toBeLessThan(after[0].lng);
    expectNoPointInside(zone, result.segments);
  });

  it('la totalité l’emporte sur les autres masques', () => {
    const points = line(11);
    const result = projectShareableTrace(points, [
      { kind: 'zone', zone: { kind: 'circle', center: { lng: 0.005, lat: 0 }, radiusM: 10 } },
      { kind: 'all' },
      { kind: 'start', meters: 10 },
    ]);

    expect(result.error).toBeNull();
    expect(result.fullyMasked).toBe(true);
    expect(result.segments).toEqual([]);
  });
});

describe('projectShareableTrace — entrées invalides', () => {
  const invalidPoints: unknown[] = [
    null,
    undefined,
    {},
    'trace',
    [],
    [{ lng: 0, lat: 0 }],
    [
      { lng: Number.NaN, lat: 0 },
      { lng: 0.001, lat: 0 },
    ],
    [
      { lng: 0, lat: 91 },
      { lng: 0.001, lat: 0 },
    ],
    [
      { lng: '0', lat: 0 },
      { lng: 0.001, lat: 0 },
    ],
    [{ lng: 0, lat: 0 }, null],
    [
      { lng: 0, lat: 0 },
      { lng: 0.001, lat: 0 },
      { lng: Number.POSITIVE_INFINITY, lat: 0 },
    ],
  ];

  it('échoue fermé sur des points absents ou corrompus', () => {
    for (const input of invalidPoints) {
      const result = projectShareableTrace(input);
      expect(result.error).toBe('invalid_points');
      expect(result.segments).toEqual([]);
      expect(result.fullyMasked).toBe(false);
    }
  });

  it('échoue fermé sur un masque invalide, sans jamais rendre la trace', () => {
    const points = line(4);
    const invalidMasks: unknown[] = [
      null,
      {},
      { kind: 'start', meters: -1 },
      { kind: 'end', meters: Number.NaN },
      { kind: 'start', meters: Number.POSITIVE_INFINITY },
      { kind: 'unknown' },
      { kind: 'zone', zone: null },
      {
        kind: 'zone',
        zone: { kind: 'circle', center: { lng: 0, lat: 0 }, radiusM: 0 },
      },
      {
        kind: 'zone',
        zone: { kind: 'circle', center: { lng: 0, lat: 0 }, radiusM: Number.NaN },
      },
      {
        kind: 'zone',
        zone: { kind: 'bbox', bounds: [1, 0, 0, 1] },
      },
      {
        kind: 'zone',
        zone: { kind: 'bbox', bounds: [0, 0, 0, 0] },
      },
      {
        kind: 'zone',
        zone: { kind: 'bbox', bounds: [0, 0, 1] },
      },
    ];

    for (const mask of invalidMasks) {
      const result = projectShareableTrace(points, [mask]);
      expect(result.error).toBe('invalid_masks');
      expect(result.masked).toBe(true);
      expect(result.segments).toEqual([]);
    }
  });

  it('échoue fermé quand la liste de masques elle-même est invalide', () => {
    const points = line(4);
    for (const masks of [null, {}, 'all', 42]) {
      const result = projectShareableTrace(points, masks);
      expect(result.error).toBe('invalid_masks');
      expect(result.segments).toEqual([]);
    }
  });
});
