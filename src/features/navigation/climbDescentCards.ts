/**
 * Lot N01 — Cartes de montée et descente pendant le suivi (K4.09).
 *
 * Responsabilités :
 * - Découper un profil altimétrique (`ElevationPoint[]`) en tronçons significatifs
 *   de montée (`climb`) et de descente (`descent`).
 * - Invariant DEM : un trou (`ele === null`) n'invente jamais d'altitude ni de
 *   pente ; il interrompt proprement le tronçon en cours.
 * - Évaluer l'état temporaire à la position `currentAlongTrackM` :
 *   - `active_climb` / `active_descent` pendant le tronçon, avec progression
 *     (`0..1`), distance restante, D+/D− restant et pente ;
 *   - `upcoming_climb` / `upcoming_descent` à l'approche du pied (≤ `upcomingLookaheadM`) ;
 *   - `flat_or_none` dès la sortie du tronçon (retrait automatique de la carte).
 */

import type { ElevationPoint } from '../explorer-v2/geo/track';
import type {
  ClimbDescentCardState,
  NavigationUnits,
  SlopeSegment,
  SlopeSegmentKind,
} from './types';
import {
  formatNavigationDistance,
  formatNavigationElevation,
} from './unitsAndOrientation';

/** Longueur minimale d'un tronçon de montée/descente pour être qualifié (m). */
export const MIN_SLOPE_SEGMENT_LENGTH_M = 120;
/** Dénivelé minimal (D+ ou D−) d'un tronçon pour être qualifié (m). */
export const MIN_SLOPE_ELEVATION_DELTA_M = 15;
/** Pente moyenne minimale (en %) pour qualifier une montée ou une descente. */
export const MIN_AVERAGE_GRADE_PCT = 3.0;
/** Distance d'anticipation avant le pied d'une montée/descente (m). */
export const DEFAULT_UPCOMING_SLOPE_LOOKAHEAD_M = 400;

export interface DetectSlopeSegmentsOptions {
  minLengthM?: number;
  minElevationDeltaM?: number;
  minAverageGradePct?: number;
}

/**
 * Découpe une série de points `ElevationPoint` en tronçons significatifs de
 * montée (`climb`) et de descente (`descent`).
 */
export function detectClimbDescentSegments(
  profilePoints: readonly ElevationPoint[] | null | undefined,
  options: DetectSlopeSegmentsOptions = {},
): SlopeSegment[] {
  if (!profilePoints || profilePoints.length < 2) return [];

  const minLengthM = options.minLengthM ?? MIN_SLOPE_SEGMENT_LENGTH_M;
  const minDeltaM = options.minElevationDeltaM ?? MIN_SLOPE_ELEVATION_DELTA_M;
  const minGradePct = options.minAverageGradePct ?? MIN_AVERAGE_GRADE_PCT;

  const segments: SlopeSegment[] = [];
  let currentPoints: Array<{ d: number; ele: number }> = [];
  let currentKind: SlopeSegmentKind | null = null;

  const flushCandidate = () => {
    if (currentPoints.length < 2 || !currentKind) {
      currentPoints = [];
      currentKind = null;
      return;
    }

    const first = currentPoints[0];
    const last = currentPoints[currentPoints.length - 1];
    const lengthM = last.d - first.d;
    if (lengthM < minLengthM) {
      currentPoints = [];
      currentKind = null;
      return;
    }

    let gainM = 0;
    let lossM = 0;
    let maxGradePct = 0;

    for (let i = 1; i < currentPoints.length; i += 1) {
      const prev = currentPoints[i - 1];
      const curr = currentPoints[i];
      const dd = curr.d - prev.d;
      const de = curr.ele - prev.ele;
      if (de > 0) gainM += de;
      else lossM += -de;
      if (dd > 0) {
        const stepGrade = Math.abs((de / dd) * 100);
        if (stepGrade > maxGradePct) maxGradePct = stepGrade;
      }
    }

    const netDeltaM =
      currentKind === 'climb' ? last.ele - first.ele : first.ele - last.ele;
    const primaryDeltaM = currentKind === 'climb' ? gainM : lossM;
    const avgGradePct = (Math.max(0, netDeltaM) / lengthM) * 100;

    if (primaryDeltaM >= minDeltaM && avgGradePct >= minGradePct) {
      const idx = segments.length;
      segments.push({
        id: `slope-${currentKind}-${idx}-${Math.round(first.d)}`,
        kind: currentKind,
        index: idx,
        startDistanceM: Math.round(first.d),
        endDistanceM: Math.round(last.d),
        lengthM: Math.round(lengthM),
        startElevationM: Math.round(first.ele),
        endElevationM: Math.round(last.ele),
        gainM: Math.round(gainM),
        lossM: Math.round(lossM),
        averageGradePct: Math.round(avgGradePct * 10) / 10,
        maxGradePct: Math.round(maxGradePct * 10) / 10,
        points: currentPoints.map((p) => ({ d: p.d, ele: p.ele })),
      });
    }

    currentPoints = [];
    currentKind = null;
  };

  for (let i = 0; i < profilePoints.length; i += 1) {
    const pt = profilePoints[i];
    // Trou DEM : on clôt immédiatement le candidat sans inventer d'altitude
    if (
      !pt ||
      typeof pt.d !== 'number' ||
      !Number.isFinite(pt.d) ||
      pt.ele === null ||
      typeof pt.ele !== 'number' ||
      !Number.isFinite(pt.ele)
    ) {
      flushCandidate();
      continue;
    }

    if (currentPoints.length === 0) {
      currentPoints.push({ d: pt.d, ele: pt.ele });
      continue;
    }

    const prev = currentPoints[currentPoints.length - 1];
    const dd = pt.d - prev.d;
    if (dd <= 0) continue;

    const de = pt.ele - prev.ele;
    const stepGradePct = (de / dd) * 100;

    // Seuil d'engagement ou d'inversion de pente (hystérésis ±1,5 % pour tolérer un court replat)
    const stepKind: SlopeSegmentKind | 'flat' =
      stepGradePct >= 2.0 ? 'climb' : stepGradePct <= -2.0 ? 'descent' : 'flat';

    if (currentKind === null) {
      if (stepKind === 'flat') {
        currentPoints = [{ d: pt.d, ele: pt.ele }];
      } else {
        currentKind = stepKind;
        currentPoints.push({ d: pt.d, ele: pt.ele });
      }
      continue;
    }

    if (stepKind === currentKind || stepKind === 'flat') {
      currentPoints.push({ d: pt.d, ele: pt.ele });
    } else {
      // Inversion franche de pente : clôturer le tronçon précédent et repartir de `prev`
      flushCandidate();
      currentKind = stepKind;
      currentPoints = [prev, { d: pt.d, ele: pt.ele }];
    }
  }

  flushCandidate();
  return segments;
}

/** Calcule le dénivelé restant et la pente instantanée à `alongTrackM` dans un segment actif. */
function computeRemainingMetricsInSegment(
  segment: SlopeSegment,
  alongTrackM: number,
): {
  remainingElevationDeltaM: number;
  currentGradePct: number;
  remainingPoints: ElevationPoint[];
} {
  let gainRemaining = 0;
  let lossRemaining = 0;
  let currentGradePct = segment.averageGradePct;
  const remainingPoints: ElevationPoint[] = [];

  for (let i = 1; i < segment.points.length; i += 1) {
    const a = segment.points[i - 1];
    const b = segment.points[i];
    if (a.ele === null || b.ele === null) continue;
    if (b.d <= alongTrackM) continue;

    const spanD = b.d - a.d;
    const spanEle = b.ele - a.ele;

    if (a.d < alongTrackM && b.d > alongTrackM && spanD > 0) {
      const ratio = (b.d - alongTrackM) / spanD;
      const interpEle = b.ele - spanEle * ratio;
      remainingPoints.push({ d: Math.round(alongTrackM), ele: Math.round(interpEle * 10) / 10 });
      const partialDelta = spanEle * ratio;
      if (partialDelta > 0) gainRemaining += partialDelta;
      else lossRemaining += -partialDelta;
      currentGradePct = Math.round(Math.abs((spanEle / spanD) * 100) * 10) / 10;
    } else {
      if (remainingPoints.length === 0) {
        remainingPoints.push(a);
      }
      if (spanEle > 0) gainRemaining += spanEle;
      else lossRemaining += -spanEle;
    }
    remainingPoints.push(b);
  }

  const remainingElevationDeltaM = Math.round(
    segment.kind === 'climb' ? gainRemaining : lossRemaining,
  );
  return {
    remainingElevationDeltaM,
    currentGradePct,
    remainingPoints,
  };
}

export interface EvaluateClimbDescentOptions {
  units?: NavigationUnits;
  upcomingLookaheadM?: number;
  signalLost?: boolean;
}

/**
 * Évalue l'état de la carte montée/descente pendant le suivi (`K4.09`).
 *
 * - Si `signalLost` est vrai ou si le profil est absent/vide : renvoie un état
 *   inactif (`flat_or_none` ou `unavailable`) pour retirer la carte.
 * - Si l'utilisateur est dans un segment : renvoie `active_climb` ou `active_descent`.
 * - Si l'utilisateur approche d'un segment (≤ `upcomingLookaheadM`) : renvoie
 *   `upcoming_climb` ou `upcoming_descent`.
 * - Sinon : `flat_or_none`.
 */
export function evaluateClimbDescentCard(
  segments: readonly SlopeSegment[] | null | undefined,
  currentAlongTrackM: number | null | undefined,
  options: EvaluateClimbDescentOptions = {},
): ClimbDescentCardState {
  const units = options.units ?? 'metric';
  const lookaheadM = options.upcomingLookaheadM ?? DEFAULT_UPCOMING_SLOPE_LOOKAHEAD_M;

  if (!segments) {
    return {
      status: 'unavailable',
      segment: null,
      distanceToStartM: null,
      progressRatio: 0,
      remainingDistanceM: null,
      remainingElevationDeltaM: null,
      currentGradePct: null,
      remainingProfilePoints: [],
      summaryLabel: null,
    };
  }

  if (
    options.signalLost ||
    typeof currentAlongTrackM !== 'number' ||
    !Number.isFinite(currentAlongTrackM) ||
    segments.length === 0
  ) {
    return {
      status: 'flat_or_none',
      segment: null,
      distanceToStartM: null,
      progressRatio: 0,
      remainingDistanceM: null,
      remainingElevationDeltaM: null,
      currentGradePct: null,
      remainingProfilePoints: [],
      summaryLabel: null,
    };
  }

  // 1. Chercher un tronçon actif
  const active = segments.find(
    (seg) => currentAlongTrackM >= seg.startDistanceM && currentAlongTrackM < seg.endDistanceM,
  );

  if (active) {
    const travelledInSeg = Math.max(0, currentAlongTrackM - active.startDistanceM);
    const progressRatio =
      active.lengthM > 0
        ? Math.min(1, Math.max(0, Math.round((travelledInSeg / active.lengthM) * 1000) / 1000))
        : 0;
    const remainingDistanceM = Math.max(0, Math.round(active.endDistanceM - currentAlongTrackM));
    const { remainingElevationDeltaM, currentGradePct, remainingPoints } =
      computeRemainingMetricsInSegment(active, currentAlongTrackM);

    const status = active.kind === 'climb' ? 'active_climb' : 'active_descent';
    const titlePrefix = active.kind === 'climb' ? 'Montée en cours' : 'Descente en cours';
    const distLabel = formatNavigationDistance(remainingDistanceM, units);
    const eleSign = active.kind === 'climb' ? '+' : '-';
    const eleLabel = formatNavigationElevation(remainingElevationDeltaM, units, false);

    return {
      status,
      segment: active,
      distanceToStartM: 0,
      progressRatio,
      remainingDistanceM,
      remainingElevationDeltaM,
      currentGradePct,
      remainingProfilePoints: remainingPoints,
      summaryLabel: `${titlePrefix} · reste ${distLabel} (${eleSign}${eleLabel} · ${active.averageGradePct} %)`,
    };
  }

  // 2. Chercher le prochain tronçon à venir dans la fenêtre `lookaheadM`
  const upcoming = segments.find(
    (seg) =>
      seg.startDistanceM > currentAlongTrackM &&
      seg.startDistanceM - currentAlongTrackM <= lookaheadM,
  );

  if (upcoming) {
    const distanceToStartM = Math.max(0, Math.round(upcoming.startDistanceM - currentAlongTrackM));
    const primaryDelta = upcoming.kind === 'climb' ? upcoming.gainM : upcoming.lossM;
    const status = upcoming.kind === 'climb' ? 'upcoming_climb' : 'upcoming_descent';
    const titlePrefix = upcoming.kind === 'climb' ? 'Montée à venir' : 'Descente à venir';
    const inDistLabel = formatNavigationDistance(distanceToStartM, units);
    const segLenLabel = formatNavigationDistance(upcoming.lengthM, units);
    const eleSign = upcoming.kind === 'climb' ? '+' : '-';
    const eleLabel = formatNavigationElevation(primaryDelta, units, false);

    return {
      status,
      segment: upcoming,
      distanceToStartM,
      progressRatio: 0,
      remainingDistanceM: upcoming.lengthM,
      remainingElevationDeltaM: primaryDelta,
      currentGradePct: upcoming.averageGradePct,
      remainingProfilePoints: upcoming.points,
      summaryLabel: `${titlePrefix} dans ${inDistLabel} · ${segLenLabel} (${eleSign}${eleLabel} · ${upcoming.averageGradePct} %)`,
    };
  }

  // 3. Aucun tronçon actif ni imminent : retrait de l'état temporaire
  return {
    status: 'flat_or_none',
    segment: null,
    distanceToStartM: null,
    progressRatio: 0,
    remainingDistanceM: null,
    remainingElevationDeltaM: null,
    currentGradePct: null,
    remainingProfilePoints: [],
    summaryLabel: null,
  };
}
