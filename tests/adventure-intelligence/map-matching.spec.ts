import { describe, it, expect } from 'vitest';
import type { TrackPoint } from '@/features/adventure-intelligence/domain/trackNormalization';
import {
  MATCH_DEFAULTS,
  JUMP_DISTANCE_M,
  UTURN_WINDOW_S,
  matchTrackToSegments,
  buildPassages,
  type SegmentCandidate,
  type SegmentMatch,
} from '@/features/adventure-intelligence/domain/mapMatching';

function pt(lat: number, lng: number, timestamp: string, extra: Partial<TrackPoint> = {}): TrackPoint {
  return { lat, lng, timestamp, ...extra };
}

function at(seconds: number): string {
  return new Date(Date.UTC(2026, 8, 11, 8, 0, 0) + seconds * 1000).toISOString();
}

function cand(
  segmentId: number,
  distanceM: number,
  bearing?: number,
  extra: Partial<SegmentCandidate> = {}
): SegmentCandidate {
  return { segmentId, distanceM, bearingDeg: bearing, ...extra };
}

function match(
  pointIndex: number,
  segmentId: number | null,
  direction: 'forward' | 'reverse' | null,
  distanceM: number | null,
  score = 1
): SegmentMatch {
  return { pointIndex, segmentId, distanceM, direction, score };
}

describe('Map-matching progressif — TEST-A2-MATCH (moteur pur)', () => {
  it('TEST-A2-MATCH-01: accepte un candidat proche et ordonné par le score', () => {
    expect(MATCH_DEFAULTS).toEqual({
      maxDistanceM: 35,
      maxBearingDeltaDeg: 60,
      minScore: 0.5,
      jumpPenalty: 0.4,
      continuityBonus: 0.25,
    });

    const points = [pt(0, 0, at(0)), pt(0, 0.0001, at(10))];
    const candidatesFor = () => [cand(101, 5, 90)];

    const matches = matchTrackToSegments(points, candidatesFor);

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ segmentId: 101, direction: 'forward', distanceM: 5 });
    expect(matches[1].segmentId).toBe(101);
    expect(matches[0].score).toBeCloseTo(0.578571, 5);
    expect(matches[1].score).toBeCloseTo(0.778571, 5);
    expect(matches[1].score).toBeGreaterThan(matches[0].score);
  });

  it('TEST-A2-MATCH-02: rejette un candidat trop éloigné ou au score insuffisant', () => {
    const points = [pt(0, 0, at(0)), pt(0, 0.0001, at(10))];

    const tooFar = matchTrackToSegments(points, () => [cand(101, 40, 90)]);
    expect(tooFar[0]).toMatchObject({ segmentId: null, distanceM: null, direction: null });

    const tooWeak = matchTrackToSegments(points, () => [cand(101, 34, 90)]);
    expect(tooWeak[0].segmentId).toBeNull();
    expect(tooWeak[0].score).toBeLessThan(MATCH_DEFAULTS.minScore);
  });

  it('TEST-A2-MATCH-03: un cap opposé produit un match en sens inverse', () => {
    const headingEast = [pt(0, 0, at(0)), pt(0, 0.0001, at(10))];

    const reverse = matchTrackToSegments(headingEast, () => [cand(101, 5, 270)]);
    expect(reverse[1]).toMatchObject({ segmentId: 101, direction: 'reverse' });
    expect(reverse[1].score).toBeCloseTo(0.778571, 5);

    const oblique = matchTrackToSegments(headingEast, () => [cand(101, 5, 250)]);
    expect(oblique[1].direction).toBe('reverse');
    expect(oblique[1].score).toBeLessThan(reverse[1].score);
    expect(oblique[1].score).toBeGreaterThanOrEqual(MATCH_DEFAULTS.minScore);

    const tooOblique = matchTrackToSegments(headingEast, () => [cand(101, 5, 170)]);
    expect(tooOblique[1].segmentId).toBeNull();
  });

  it('TEST-A2-MATCH-04: la continuité favorise le segment déjà suivi', () => {
    const withHistory = [pt(0, 0, at(0)), pt(0, 0.0001, at(10))];
    const historyCandidates = (point: TrackPoint, index: number) =>
      index === 0 ? [cand(101, 5, 90)] : [cand(101, 13, 90), cand(202, 12, 90)];

    const history = matchTrackToSegments(withHistory, historyCandidates);
    expect(history[1].segmentId).toBe(101);

    const withoutHistory = [pt(0, 0, at(0)), pt(0, 0.0001, at(10))];
    const cold = matchTrackToSegments(withoutHistory, (_point, index) =>
      index === 0 ? [] : [cand(101, 13, 90), cand(202, 12, 90)]
    );
    expect(cold[0].segmentId).toBeNull();
    expect(cold[1].segmentId).toBe(202);
  });

  it('TEST-A2-MATCH-05: applique la pénalité de saut entre segments éloignés', () => {
    const jumpPoints = [pt(0, 0, at(0)), pt(0.006, 0, at(600))];
    const jumpCandidates = (_point: TrackPoint, index: number) =>
      index === 0 ? [cand(101, 0, 0)] : [cand(202, 0, 0)];

    const jumped = matchTrackToSegments(jumpPoints, jumpCandidates);
    expect(jumped[1].segmentId).toBeNull();
    expect(jumped[1].score).toBeCloseTo(0.425, 5);

    const nearPoints = [pt(0, 0, at(0)), pt(0.0001, 0, at(30))];
    const near = matchTrackToSegments(nearPoints, jumpCandidates);
    expect(near[1].segmentId).toBe(202);
    expect(near[1].score).toBeCloseTo(0.825, 5);

    const sameSegment = matchTrackToSegments(jumpPoints, () => [cand(101, 0, 0)]);
    expect(sameSegment[1].score).toBeCloseTo(0.85, 5);

    expect(JUMP_DISTANCE_M).toBe(500);
  });

  it('TEST-A2-MATCH-06: choisit le meilleur score parmi les candidats ordonnés', () => {
    const points = [pt(0, 0, at(0)), pt(0, 0.0001, at(10))];
    const candidatesFor = (_point: TrackPoint, index: number) =>
      index === 0
        ? [cand(999, 0, 90)]
        : [cand(101, 20, 90), cand(202, 5, 90), cand(303, 30, 90)];

    const matches = matchTrackToSegments(points, candidatesFor);

    expect(matches[1].segmentId).toBe(202);
    expect(matches[1].distanceM).toBe(5);
    expect(matches[1].score).toBeCloseTo(0.753571, 5);

    const empty = matchTrackToSegments(points, () => []);
    expect(empty[1]).toEqual({
      pointIndex: 1,
      segmentId: null,
      distanceM: null,
      direction: null,
      score: 0,
    });
  });

  it('TEST-A2-MATCH-07: regroupe les passages consécutifs de même sens et déduit les arrêts', () => {
    const points = [
      pt(0, 0, at(0)),
      pt(0, 0.0001, at(10)),
      pt(0, 0.0002, at(20)),
      pt(0.0001, 0.0002, at(30)),
      pt(0.0002, 0.0002, at(40)),
    ];
    const matches = [
      match(0, 101, 'forward', 3),
      match(1, 101, 'forward', 2),
      match(2, 101, 'forward', 1),
      match(3, 202, 'forward', 4),
      match(4, 202, 'forward', 5),
    ];
    const pauses = [
      { startIndex: 1, endIndex: 2, startAt: at(10), endAt: at(20), durationS: 10 },
    ];

    const passages = buildPassages(matches, points, pauses);

    expect(passages).toHaveLength(2);
    expect(passages[0]).toMatchObject({
      segmentId: 101,
      direction: 'forward',
      enteredAt: at(0),
      exitedAt: at(20),
      durationS: 20,
      stoppedS: 10,
      movingS: 10,
      offRoute: false,
      uturnDetected: false,
    });
    expect(passages[0].distanceM).toBeCloseTo(22.24, 1);
    expect(passages[0].mapMatchQuality).toBeCloseTo(1, 5);

    const sparseMatches = matches.map((item, index) =>
      index === 0 ? item : { ...item, segmentId: null, direction: null, distanceM: null }
    );
    const sparse = buildPassages(sparseMatches, points, []);
    expect(sparse).toHaveLength(0);
  });

  it('TEST-A2-MATCH-08: détecte le demi-tour et la sortie d’itinéraire', () => {
    const points = Array.from({ length: 6 }, (_, i) => pt(0, i * 0.0001, at(i * 60)));
    const uturnMatches = [
      match(0, 101, 'forward', 2),
      match(1, 101, 'forward', 2),
      match(2, null, null, null, 0),
      match(3, null, null, null, 0),
      match(4, 101, 'reverse', 2),
      match(5, 101, 'reverse', 2),
    ];

    const uturn = buildPassages(uturnMatches, points, []);

    expect(uturn).toHaveLength(2);
    expect(uturn[0].uturnDetected).toBe(true);
    expect(uturn[1].uturnDetected).toBe(true);
    expect(uturn[0].offRoute).toBe(true);
    expect(uturn[1].offRoute).toBe(true);
    expect(uturn[1].direction).toBe('reverse');
    expect(uturn[0].mapMatchQuality).toBeCloseTo(4 / 6, 5);
    expect(UTURN_WINDOW_S).toBe(600);

    const straightMatches = [
      match(0, 101, 'forward', 2),
      match(1, 101, 'forward', 2),
      match(2, null, null, null, 0),
      match(3, null, null, null, 0),
      match(4, 101, 'forward', 2),
      match(5, 101, 'forward', 2),
    ];
    const straight = buildPassages(straightMatches, points, []);
    expect(straight[0].uturnDetected).toBe(false);
    expect(straight[1].uturnDetected).toBe(false);
    expect(straight[0].offRoute).toBe(true);
  });
});
