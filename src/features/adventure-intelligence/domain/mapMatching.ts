/**
 * Map-matching progressif et extraction de passages.
 *
 * Moteur pur (ADR-AI-005) : les candidats sont injectés par `candidatesFor`,
 * aucun accès réseau ni base dans ce module.
 *
 * Score d'un candidat :
 *   0.5 * proximité + 0.3 * direction + 0.2 * continuité − pénalité de saut.
 *   - proximité = max(0, 1 − distance / maxDistanceM)
 *   - direction = 1 − min(delta / 180, 1), delta = écart cap trace/candidat
 *     (0,5 de repli sans cap ; un candidat à contre-sens est retourné en
 *     `reverse` puis le delta résolu est comparé à `maxBearingDeltaDeg`)
 *   - continuité = bonus complet si même segment que le point précédent,
 *     demi-bonus si le candidat diffère mais reste à moins de 25 m
 *   - pénalité = `jumpPenalty` si le point bondit de plus de 500 m vers un
 *     autre segment (les téléportations sont déjà retirées en amont : le saut
 *     observable est la distance entre points consécutifs conservés)
 */
import type { TrackPause, TrackPoint } from './trackNormalization';
import { elevationGainLoss, NORMALIZATION_DEFAULTS } from './trackNormalization';
import { bearingDeg, haversineM } from './geo';

export interface SegmentCandidate {
  segmentId: number;
  distanceM: number;
  bearingDeg?: number;
  highway?: string | null;
  surface?: string | null;
  sacScale?: string | null;
}

export interface MatchOptions {
  maxDistanceM: number;
  maxBearingDeltaDeg: number;
  minScore: number;
  jumpPenalty: number;
  continuityBonus: number;
}

export const MATCH_DEFAULTS: MatchOptions = {
  maxDistanceM: 35,
  maxBearingDeltaDeg: 60,
  minScore: 0.5,
  jumpPenalty: 0.4,
  continuityBonus: 0.25,
};

/** Distance au-delà de laquelle un changement de segment est une anomalie. */
export const JUMP_DISTANCE_M = 500;
/** Rayon du demi-bonus de continuité pour un candidat différent. */
export const CONTINUITY_NEAR_M = 25;
/** Fenêtre de détection du demi-tour sur un même segment. */
export const UTURN_WINDOW_S = 600;

export interface SegmentMatch {
  pointIndex: number;
  segmentId: number | null;
  distanceM: number | null;
  direction: 'forward' | 'reverse' | null;
  score: number;
}

export interface MatchedPassage {
  segmentId: number;
  direction: 'forward' | 'reverse';
  enteredAt: string;
  exitedAt: string;
  durationS: number;
  movingS: number;
  stoppedS: number;
  distanceM: number;
  gainM: number;
  lossM: number;
  offRoute: boolean;
  uturnDetected: boolean;
  mapMatchQuality: number;
}

function angularDeltaDeg(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

function parseTimeMs(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Apparie chaque point conservé au meilleur segment candidat.
 * Un candidat est retenu si `distance ≤ maxDistanceM`, si son orientation
 * résolue ne dépasse pas `maxBearingDeltaDeg` et si son score ≥ `minScore`.
 */
export function matchTrackToSegments(
  points: TrackPoint[],
  candidatesFor: (point: TrackPoint, index: number) => SegmentCandidate[],
  options?: Partial<MatchOptions>
): SegmentMatch[] {
  const config: MatchOptions = { ...MATCH_DEFAULTS, ...options };
  const matches: SegmentMatch[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const previousPoint = index > 0 ? points[index - 1] : undefined;
    const previousMatch = index > 0 ? matches[index - 1] : undefined;

    let trackBearing: number | undefined;
    if (previousPoint) {
      const previousToCurrent = haversineM(previousPoint, point);
      if (previousToCurrent > 0) {
        trackBearing = bearingDeg(previousPoint, point);
      }
    }

    const candidates = candidatesFor(point, index);
    let best: SegmentMatch | null = null;

    for (const candidate of candidates) {
      const distanceM = Math.max(0, candidate.distanceM);
      if (distanceM > config.maxDistanceM) continue;

      let direction: 'forward' | 'reverse' = 'forward';
      let directionScore = 0.5;
      if (trackBearing !== undefined && candidate.bearingDeg !== undefined) {
        const rawDelta = angularDeltaDeg(candidate.bearingDeg, trackBearing);
        const resolvedDelta = rawDelta > 90 ? 180 - rawDelta : rawDelta;
        if (resolvedDelta > config.maxBearingDeltaDeg) continue;
        direction = rawDelta > 90 ? 'reverse' : 'forward';
        directionScore = 1 - Math.min(resolvedDelta / 180, 1);
      }

      const proximity = Math.max(0, 1 - distanceM / config.maxDistanceM);

      let continuity = 0;
      if (previousMatch && previousMatch.segmentId !== null) {
        if (previousMatch.segmentId === candidate.segmentId) {
          continuity = config.continuityBonus;
        } else if (distanceM <= CONTINUITY_NEAR_M) {
          continuity = config.continuityBonus * 0.5;
        }
      }

      let jumpPenalty = 0;
      if (
        previousMatch &&
        previousMatch.segmentId !== null &&
        previousMatch.segmentId !== candidate.segmentId &&
        previousPoint &&
        haversineM(previousPoint, point) > JUMP_DISTANCE_M
      ) {
        jumpPenalty = config.jumpPenalty;
      }

      const score = Math.max(0, 0.5 * proximity + 0.3 * directionScore + 0.2 * continuity - jumpPenalty);

      if (best === null || score > best.score) {
        best = {
          pointIndex: index,
          segmentId: candidate.segmentId,
          distanceM,
          direction,
          score,
        };
      }
    }

    if (best !== null && best.score >= config.minScore) {
      matches.push(best);
    } else {
      matches.push({
        pointIndex: index,
        segmentId: null,
        distanceM: null,
        direction: null,
        score: best === null ? 0 : best.score,
      });
    }
  }

  return matches;
}

function overlapS(pause: TrackPause, fromIso: string, toIso: string): number {
  const start = Math.max(parseTimeMs(pause.startAt), parseTimeMs(fromIso));
  const end = Math.min(parseTimeMs(pause.endAt), parseTimeMs(toIso));
  return Math.max(0, (end - start) / 1000);
}

interface PassageDraft {
  startIndex: number;
  endIndex: number;
  passage: MatchedPassage;
}

/**
 * Construit les passages à partir des appariements : groupes consécutifs de
 * même `(segmentId, direction)` d'au moins deux points. `mapMatchQuality` est
 * le ratio global points appariés / points conservés de la trace.
 */
export function buildPassages(
  matches: SegmentMatch[],
  points: TrackPoint[],
  pauses: TrackPause[]
): MatchedPassage[] {
  const matchedCount = matches.filter((item) => item.segmentId !== null).length;
  const mapMatchQuality = matches.length > 0 ? matchedCount / matches.length : 0;
  const drafts: PassageDraft[] = [];

  let index = 0;
  while (index < matches.length) {
    const current = matches[index];
    if (current.segmentId === null || current.direction === null) {
      index += 1;
      continue;
    }

    let end = index;
    while (
      end + 1 < matches.length &&
      matches[end + 1].segmentId === current.segmentId &&
      matches[end + 1].direction === current.direction
    ) {
      end += 1;
    }

    if (end - index + 1 >= 2) {
      const enteredAt = points[index].timestamp;
      const exitedAt = points[end].timestamp;
      const durationS = Math.max(0, (parseTimeMs(exitedAt) - parseTimeMs(enteredAt)) / 1000);

      let distanceM = 0;
      for (let i = index + 1; i <= end; i += 1) {
        distanceM += haversineM(points[i - 1], points[i]);
      }

      const { gainM, lossM } = elevationGainLoss(
        points.slice(index, end + 1).map((point) => point.ele),
        NORMALIZATION_DEFAULTS.elevationHysteresisM
      );

      const stoppedS = pauses.reduce((sum, pause) => sum + overlapS(pause, enteredAt, exitedAt), 0);

      drafts.push({
        startIndex: index,
        endIndex: end,
        passage: {
          segmentId: current.segmentId,
          direction: current.direction,
          enteredAt,
          exitedAt,
          durationS,
          movingS: Math.max(0, durationS - stoppedS),
          stoppedS,
          distanceM,
          gainM,
          lossM,
          offRoute: false,
          uturnDetected: false,
          mapMatchQuality,
        },
      });
    }

    index = end + 1;
  }

  for (let a = 0; a < drafts.length; a += 1) {
    for (let b = a + 1; b < drafts.length; b += 1) {
      const first = drafts[a].passage;
      const second = drafts[b].passage;
      if (first.segmentId !== second.segmentId || first.direction === second.direction) continue;
      const gapS = (parseTimeMs(second.enteredAt) - parseTimeMs(first.exitedAt)) / 1000;
      if (gapS >= 0 && gapS <= UTURN_WINDOW_S) {
        drafts[a].passage.uturnDetected = true;
        drafts[b].passage.uturnDetected = true;
      }
    }
  }

  for (let a = 0; a + 1 < drafts.length; a += 1) {
    const first = drafts[a];
    const second = drafts[a + 1];
    if (first.passage.segmentId !== second.passage.segmentId) continue;
    let unmatched = 0;
    for (let i = first.endIndex + 1; i < second.startIndex; i += 1) {
      if (matches[i].segmentId === null) unmatched += 1;
    }
    if (unmatched >= 2) {
      first.passage.offRoute = true;
      second.passage.offRoute = true;
    }
  }

  return drafts.map((draft) => draft.passage);
}
