/**
 * Allure ajustée à la pente — GAP (A04 · S2.09).
 *
 * Modèle de coût énergétique de course à pied : Minetti et al. (2002),
 * « Energy cost of walking and running at extreme uphill and downhill slopes ».
 *   C(i) = 155.4 i^5 - 30.4 i^4 - 43.3 i^3 + 46.3 i^2 + 19.5 i + 3.6  (J/kg/m)
 *   C(0) = 3.6 J/kg/m
 *   ratio(i) = C(i) / C(0)
 *
 * Règles C-MET :
 *   - réservé aux sports de course à pied (`course`, `trail`) ;
 *   - exige au moins deux points avec coordonnées, horodatage et altitude
 *     réelle (aucune altitude inventée) ;
 *   - les pentes extrêmes sont bornées à [-0.45, +0.45] pour rester dans le
 *     domaine validé du polynôme de Minetti ;
 *   - chaque valeur produite est explicitement étiquetée `estimated`, jamais
 *     `measured`, sans équivalence propriétaire revendiquée.
 */

import type { MetricQuality, Sport } from '../state/types';

export const SLOPE_ADJUSTED_PACE_SPORTS: ReadonlySet<Sport> = new Set<Sport>([
  'course',
  'trail',
]);

export const SLOPE_ADJUSTED_PACE_METHOD = 'minetti-2002-v1' as const;

export const SLOPE_ADJUSTED_PACE_WOULD_BE_QUALITY: Extract<MetricQuality, 'estimated'> =
  'estimated';

export const SLOPE_ADJUSTED_PACE_UNAVAILABLE_REASON =
  'Altitude ou horodatage insuffisant pour estimer l’allure ajustée à la pente.';

export interface GapTracePoint {
  lat: number;
  lng: number;
  elevationM: number | null;
  timestampMs: number | null;
}

export interface GapSegmentReading {
  distanceM: number;
  durationS: number;
  grade: number;
  rawPaceSecondsPerKm: number;
  gapPaceSecondsPerKm: number;
}

export interface SlopeAdjustedPaceAvailable {
  status: 'available';
  method: typeof SLOPE_ADJUSTED_PACE_METHOD;
  quality: typeof SLOPE_ADJUSTED_PACE_WOULD_BE_QUALITY;
  proprietaryEquivalent: false;
  rawPaceSecondsPerKm: number;
  gapPaceSecondsPerKm: number;
  averageGradePercent: number;
  gradeFactor: number;
  coveredDistanceM: number;
  coveredDurationS: number;
  segments: GapSegmentReading[];
}

export interface SlopeAdjustedPaceAvailability {
  status: 'unavailable';
  method: null;
  parameters: null;
  wouldBeQuality: typeof SLOPE_ADJUSTED_PACE_WOULD_BE_QUALITY;
  proprietaryEquivalent: false;
  reason: string;
}

export type SlopeAdjustedPaceResult =
  | SlopeAdjustedPaceAvailable
  | SlopeAdjustedPaceAvailability;

const EARTH_RADIUS_M = 6_371_000;
const MIN_SEGMENT_DISTANCE_M = 15;
const MAX_SEGMENT_SPEED_MPS = 11.0; // ~1:31/km anti-pic GPS
const MIN_MOVING_SPEED_MPS = 0.6;
const MIN_GRADE = -0.45;
const MAX_GRADE = 0.45;
const COST_FLAT_MINETTI = 3.6;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Ratio du coût énergétique de Minetti (2002) par rapport au plat.
 * Retourne un facteur > 1 en montée (l'allure équivalente sur plat est plus
 * rapide que l'allure réelle) et < 1 en descente douce (jusqu'à ~-20 %).
 */
export function minettiCostRatio(rawGrade: number): number {
  const i = Math.max(MIN_GRADE, Math.min(MAX_GRADE, rawGrade));
  const cost =
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    COST_FLAT_MINETTI;
  return Math.max(0.45, cost / COST_FLAT_MINETTI);
}

export function supportsSlopeAdjustedPace(sport: Sport | string | null | undefined): boolean {
  if (!sport) return false;
  return SLOPE_ADJUSTED_PACE_SPORTS.has(sport as Sport);
}

function unavailableReading(reason: string): SlopeAdjustedPaceAvailability {
  return {
    status: 'unavailable',
    method: null,
    parameters: null,
    wouldBeQuality: SLOPE_ADJUSTED_PACE_WOULD_BE_QUALITY,
    proprietaryEquivalent: false,
    reason,
  };
}

/**
 * Calcule l'allure ajustée à la pente (GAP) sur des fenêtres lissées d'au
 * moins 15 m afin d'éviter le bruit altimétrique point-à-point.
 */
export function computeSlopeAdjustedPace(
  sport: Sport | string | null | undefined,
  points: readonly GapTracePoint[],
): SlopeAdjustedPaceResult | null {
  if (!supportsSlopeAdjustedPace(sport)) return null;
  if (!Array.isArray(points) || points.length < 2) {
    return unavailableReading(SLOPE_ADJUSTED_PACE_UNAVAILABLE_REASON);
  }

  const segments: GapSegmentReading[] = [];
  let anchor = points[0];
  let accDistanceM = 0;
  let accDurationS = 0;
  let prev = points[0];

  for (let idx = 1; idx < points.length; idx += 1) {
    const curr = points[idx];
    if (
      !Number.isFinite(curr.lat) ||
      !Number.isFinite(curr.lng) ||
      !Number.isFinite(prev.lat) ||
      !Number.isFinite(prev.lng)
    ) {
      prev = curr;
      anchor = curr;
      accDistanceM = 0;
      accDurationS = 0;
      continue;
    }

    const dM = haversineDistanceM(prev.lat, prev.lng, curr.lat, curr.lng);
    const dtS =
      curr.timestampMs !== null &&
      prev.timestampMs !== null &&
      curr.timestampMs > prev.timestampMs
        ? (curr.timestampMs - prev.timestampMs) / 1000
        : null;

    if (dtS === null || dtS <= 0 || dtS > 120) {
      // Trou temporel ou horodatage absent : on réinitialise l'ancre
      prev = curr;
      anchor = curr;
      accDistanceM = 0;
      accDurationS = 0;
      continue;
    }

    const speed = dM / dtS;
    if (speed > MAX_SEGMENT_SPEED_MPS || speed < MIN_MOVING_SPEED_MPS) {
      prev = curr;
      if (speed > MAX_SEGMENT_SPEED_MPS) {
        anchor = curr;
        accDistanceM = 0;
        accDurationS = 0;
      }
      continue;
    }

    accDistanceM += dM;
    accDurationS += dtS;
    prev = curr;

    if (
      accDistanceM >= MIN_SEGMENT_DISTANCE_M &&
      anchor.elevationM !== null &&
      Number.isFinite(anchor.elevationM) &&
      curr.elevationM !== null &&
      Number.isFinite(curr.elevationM)
    ) {
      const dEle = curr.elevationM - anchor.elevationM;
      const grade = Math.max(MIN_GRADE, Math.min(MAX_GRADE, dEle / accDistanceM));
      const ratio = minettiCostRatio(grade);
      const rawPace = (accDurationS / accDistanceM) * 1000;
      const gapPace = rawPace / ratio;

      segments.push({
        distanceM: accDistanceM,
        durationS: accDurationS,
        grade,
        rawPaceSecondsPerKm: rawPace,
        gapPaceSecondsPerKm: gapPace,
      });

      anchor = curr;
      accDistanceM = 0;
      accDurationS = 0;
    } else if (curr.elevationM === null || anchor.elevationM === null) {
      anchor = curr;
      accDistanceM = 0;
      accDurationS = 0;
    }
  }

  if (segments.length === 0) {
    return unavailableReading(SLOPE_ADJUSTED_PACE_UNAVAILABLE_REASON);
  }

  let totalDistanceM = 0;
  let totalDurationS = 0;
  let weightedGapTimeS = 0;
  let weightedGradeDistance = 0;

  for (const seg of segments) {
    totalDistanceM += seg.distanceM;
    totalDurationS += seg.durationS;
    weightedGapTimeS += (seg.gapPaceSecondsPerKm * seg.distanceM) / 1000;
    weightedGradeDistance += seg.grade * seg.distanceM;
  }

  if (totalDistanceM <= 0 || totalDurationS <= 0 || weightedGapTimeS <= 0) {
    return unavailableReading(SLOPE_ADJUSTED_PACE_UNAVAILABLE_REASON);
  }

  const rawPaceSecondsPerKm = (totalDurationS / totalDistanceM) * 1000;
  const gapPaceSecondsPerKm = (weightedGapTimeS / totalDistanceM) * 1000;
  const averageGradePercent = (weightedGradeDistance / totalDistanceM) * 100;
  const gradeFactor = rawPaceSecondsPerKm / gapPaceSecondsPerKm;

  return {
    status: 'available',
    method: SLOPE_ADJUSTED_PACE_METHOD,
    quality: SLOPE_ADJUSTED_PACE_WOULD_BE_QUALITY,
    proprietaryEquivalent: false,
    rawPaceSecondsPerKm,
    gapPaceSecondsPerKm,
    averageGradePercent,
    gradeFactor,
    coveredDistanceM: totalDistanceM,
    coveredDurationS: totalDurationS,
    segments,
  };
}

/**
 * Point d'entrée rétrocompatible (accepte des points optionnels).
 */
export function readSlopeAdjustedPace(
  sport: Sport | string | null | undefined,
  points?: readonly GapTracePoint[],
): SlopeAdjustedPaceResult | null {
  if (!supportsSlopeAdjustedPace(sport)) return null;
  if (!points || points.length < 2) {
    return unavailableReading(SLOPE_ADJUSTED_PACE_UNAVAILABLE_REASON);
  }
  return computeSlopeAdjustedPace(sport, points);
}
