import { describe, it, expect } from 'vitest';
import {
  haversineM,
  bearingDeg,
  smoothAltitude,
  cumulativeDistancesM,
} from '@/features/adventure-intelligence/domain/geo';
import {
  normalizeTrack,
  NORMALIZATION_DEFAULTS,
  type TrackPoint,
} from '@/features/adventure-intelligence/domain/trackNormalization';

function pt(
  lat: number,
  lng: number,
  timestamp: string,
  extra: Partial<TrackPoint> = {}
): TrackPoint {
  return { lat, lng, timestamp, ...extra };
}

/** Secondes après l'époque de référence des fixtures. */
function at(seconds: number): string {
  return new Date(Date.UTC(2026, 8, 11, 8, 0, 0) + seconds * 1000).toISOString();
}

describe('Géométrie pure — haversine, cap, lissage, distance cumulée', () => {
  it('TEST-A2-GEO-01: haversine mesure les distances de référence', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111194.93, 0);
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 })).toBeCloseTo(111.19, 0);
  });

  it('TEST-A2-GEO-02: bearingDeg retourne un cap nord/cardinal normalisé [0,360[', () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 5);
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 5);
    expect(bearingDeg({ lat: 0, lng: 1 }, { lat: 0, lng: 0 })).toBeCloseTo(270, 5);
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180, 5);
  });

  it('TEST-A2-GEO-03: smoothAltitude moyenne les valeurs définies de la fenêtre', () => {
    const smoothed = smoothAltitude([100, 102, 104, undefined, 108, 110, 112], 5);
    expect(smoothed[0]).toBeCloseTo(102, 6);
    expect(smoothed[1]).toBeCloseTo(102, 6);
    expect(smoothed[2]).toBeCloseTo(103.5, 6);
    expect(smoothed[3]).toBeCloseTo(106, 6);
    expect(smoothed[4]).toBeCloseTo(108.5, 6);
    expect(smoothed[5]).toBeCloseTo(110, 6);
    expect(smoothed[6]).toBeCloseTo(110, 6);

    const holes = smoothAltitude([undefined, undefined, 100], 3);
    expect(holes[0]).toBeUndefined();
    expect(holes[1]).toBeCloseTo(100, 6);
    expect(holes[2]).toBeCloseTo(100, 6);
  });

  it('TEST-A2-GEO-04: cumulativeDistancesM retourne des distances préfixes cohérentes', () => {
    const distances = cumulativeDistancesM([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0, lng: 0.002 },
    ]);
    expect(distances[0]).toBe(0);
    expect(distances[1]).toBeCloseTo(111.19, 0);
    expect(distances[2]).toBeCloseTo(222.39, 0);
  });
});

describe('Normalisation de trace GPS — TEST-A2-NORM (moteur pur)', () => {
  it('TEST-A2-NORM-01: trie par horodatage et rejette les points invalides', () => {
    const raw = [
      pt(91, 0, at(0)),
      pt(0.0002, 0, at(20)),
      pt(0.0001, 0, 'pas-une-date'),
      pt(0, 0, at(0)),
      pt(0.0003, 0, at(30)),
    ];

    const result = normalizeTrack(raw);

    expect(result.rejected).toEqual([
      { index: 0, reason: 'invalid' },
      { index: 2, reason: 'invalid' },
    ]);
    expect(result.points.map((p) => p.timestamp)).toEqual([at(0), at(20), at(30)]);
    expect(result.points.map((p) => p.lat)).toEqual([0, 0.0002, 0.0003]);
  });

  it('TEST-A2-NORM-02: rejette une précision GPS au-delà du seuil', () => {
    const raw = [
      pt(0, 0, at(0), { accuracyM: 80 }),
      pt(0.0001, 0, at(30), { accuracyM: NORMALIZATION_DEFAULTS.maxAccuracyM }),
      pt(0.0002, 0, at(60)),
    ];

    const result = normalizeTrack(raw);

    expect(result.rejected).toEqual([{ index: 0, reason: 'accuracy' }]);
    expect(result.points).toHaveLength(2);
    expect(result.points[0].accuracyM).toBe(50);
  });

  it('TEST-A2-NORM-03: doublon d’horodatage — conserve la meilleure précision', () => {
    const raw = [
      pt(0, 0, at(0), { accuracyM: 20 }),
      pt(0.001, 0, at(0), { accuracyM: 10 }),
      pt(0.002, 0, at(0)),
      pt(0.0011, 0, at(300)),
    ];

    const result = normalizeTrack(raw);

    expect(result.rejected).toEqual([
      { index: 0, reason: 'duplicate' },
      { index: 2, reason: 'duplicate' },
    ]);
    expect(result.points.map((p) => p.lat)).toEqual([0.001, 0.0011]);
  });

  it('TEST-A2-NORM-04: rejette les téléportations (vitesse ou saut excessif)', () => {
    const bySpeed = normalizeTrack([
      pt(0, 0, at(0)),
      pt(0.01, 0, at(10)),
      pt(0.0101, 0, at(20)),
      pt(0.0001, 0, at(30)),
    ]);
    expect(bySpeed.rejected).toEqual([
      { index: 1, reason: 'teleport' },
      { index: 2, reason: 'teleport' },
    ]);
    expect(bySpeed.points.map((p) => p.lat)).toEqual([0, 0.0001]);

    const byJump = normalizeTrack([pt(0, 0, at(0)), pt(0.006, 0, at(120))]);
    expect(byJump.rejected).toEqual([{ index: 1, reason: 'teleport' }]);
    expect(byJump.points).toHaveLength(1);
  });

  it('TEST-A2-NORM-05: lisse l’altitude sur une fenêtre de 5 points', () => {
    const raw = [
      pt(0, 0, at(0), { ele: 100 }),
      pt(0.0001, 0, at(10), { ele: 102 }),
      pt(0.0002, 0, at(20), { ele: 104 }),
      pt(0.0003, 0, at(30)),
      pt(0.0004, 0, at(40), { ele: 108 }),
      pt(0.0005, 0, at(50), { ele: 110 }),
      pt(0.0006, 0, at(60), { ele: 112 }),
    ];

    const result = normalizeTrack(raw);

    expect(result.points.map((p) => p.ele)).toEqual([102, 102, 103.5, 106, 108.5, 110, 110]);
  });

  it('TEST-A2-NORM-06: détecte les pauses et les exclut du temps en mouvement', () => {
    const raw = [
      pt(0, 0, at(0), { ele: 100 }),
      pt(0.0001, 0, at(30), { ele: 100 }),
      pt(0.0002, 0, at(60), { ele: 100 }),
      pt(0.0002, 0, at(120), { ele: 100 }),
      pt(0.0002, 0, at(180), { ele: 100 }),
      pt(0.0002, 0, at(240), { ele: 100 }),
      pt(0.0003, 0, at(270), { ele: 100 }),
    ];

    const result = normalizeTrack(raw);

    expect(result.pauses).toEqual([
      {
        startIndex: 2,
        endIndex: 5,
        startAt: at(60),
        endAt: at(240),
        durationS: 180,
      },
    ]);
    expect(result.metrics.totalDurationS).toBe(270);
    expect(result.metrics.movingDurationS).toBe(90);
    expect(result.metrics.movingDurationS).toBeLessThan(result.metrics.totalDurationS);
    expect(result.metrics.distanceM).toBeCloseTo(33.36, 0);
  });

  it('TEST-A2-NORM-07: calcule D+/D- avec hystérésis de 3 m', () => {
    const elevations = [100, 100, 100, 102, 102, 104, 104, 102, 102, 100, 100];
    const raw = elevations.map((ele, i) => pt(i * 0.0001, 0, at(i * 30), { ele }));

    const result = normalizeTrack(raw, { altitudeWindow: 1 });

    expect(result.metrics.gainM).toBe(4);
    expect(result.metrics.lossM).toBe(4);
  });

  it('TEST-A2-NORM-08: qualité pondérée, justifiée quand overall < 0.5', () => {
    expect(NORMALIZATION_DEFAULTS).toEqual({
      maxAccuracyM: 50,
      maxSpeedMps: 8.34,
      maxJumpM: 500,
      altitudeWindow: 5,
      stopSpeedMps: 0.3,
      minPauseS: 60,
      elevationHysteresisM: 3,
    });

    const degraded = normalizeTrack([
      pt(95, 0, at(0)),
      pt(0, 0, 'invalid'),
      pt(0, 0, at(0), { accuracyM: 45 }),
      pt(0.01, 0, at(10), { accuracyM: 45 }),
      pt(0.02, 0, at(20), { accuracyM: 45 }),
      pt(0.0001, 0, at(30), { accuracyM: 45 }),
      pt(0.0002, 0, at(60), { accuracyM: 45 }),
      pt(0.0003, 0, at(90), { accuracyM: 45 }),
      pt(0.0004, 0, at(120), { accuracyM: 45 }),
      pt(0.0005, 0, at(150), { accuracyM: 45 }),
    ]);

    expect(degraded.quality.overall).toBeLessThan(0.5);
    expect(degraded.quality.reasons.length).toBeGreaterThan(0);
    expect(degraded.quality.overall).toBeCloseTo(
      0.35 * degraded.quality.gpsAccuracy +
        0.25 * degraded.quality.temporalContinuity +
        0.2 * degraded.quality.altitudeReliability +
        0.2 * degraded.quality.plausibleMovement,
      10
    );

    const clean = normalizeTrack([
      pt(0, 0, at(0), { accuracyM: 5, ele: 100 }),
      pt(0.0001, 0, at(30), { accuracyM: 5, ele: 101 }),
      pt(0.0002, 0, at(60), { accuracyM: 5, ele: 102 }),
      pt(0.0003, 0, at(90), { accuracyM: 5, ele: 103 }),
      pt(0.0004, 0, at(120), { accuracyM: 5, ele: 104 }),
      pt(0.0005, 0, at(150), { accuracyM: 5, ele: 105 }),
    ]);

    expect(clean.quality.overall).toBeGreaterThan(0.9);
    expect(clean.quality.reasons).toEqual([]);
    expect(clean.metrics.avgSpeedKmh).toBeGreaterThan(0);
    expect(clean.metrics.movingSpeedKmh).toBeGreaterThanOrEqual(clean.metrics.avgSpeedKmh);
  });
});
