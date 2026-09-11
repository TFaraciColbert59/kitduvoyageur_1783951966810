/**
 * Caractéristiques dérivées de segment — longueur, D+/D-, pentes, classe technique.
 *
 * Moteur pur (ADR-AI-005) : aucune I/O. Les altitudes absentes sont ignorées.
 * `exposureClass` / `isolationClass` restent `null` : aucune source ne les
 * alimente à cette phase (honnête et documenté, pas de valeur inventée).
 */
import { haversineM } from './geo';

export interface SegmentGeometryInput {
  segmentId: number;
  points: { lat: number; lng: number; ele?: number }[];
  highway?: string | null;
  surface?: string | null;
  sacScale?: string | null;
}

export interface SegmentFeaturesResult {
  segmentId: number;
  lengthM: number;
  gainM: number;
  lossM: number;
  meanGradePct: number;
  maxGradePct: number;
  altitudeMinM: number | null;
  altitudeMaxM: number | null;
  surface: string | null;
  technicalClass: 0 | 1 | 2 | 3 | 4 | 5;
  exposureClass: null;
  isolationClass: null;
  source: 'computed';
}

/** Fenêtre minimale de calcul de pente (lisse les micro-variations GPS/OSM). */
export const MIN_GRADE_WINDOW_M = 20;

const SAC_SCALE_CLASSES: Record<string, 0 | 1 | 2 | 3 | 4 | 5> = {
  hiking: 1,
  mountain_hiking: 2,
  demanding_mountain_hiking: 3,
  alpine_hiking: 4,
  demanding_alpine_hiking: 5,
};

const HIGHWAY_CLASSES: Record<string, 0 | 1 | 2 | 3 | 4 | 5> = {
  footway: 0,
  path: 1,
  track: 1,
  bridleway: 1,
  steps: 2,
};

function definedElevations(points: SegmentGeometryInput['points']): number[] {
  return points
    .map((point) => point.ele)
    .filter((ele): ele is number => typeof ele === 'number' && Number.isFinite(ele));
}

/**
 * Classe technique heuristique : `sac_scale` prime, sinon `highway`,
 * sinon 1 ; une surface `rock`/`scree` ajoute +1 (plafonné à 5).
 */
export function technicalClassFromTags(tags: {
  highway?: string | null;
  sacScale?: string | null;
  surface?: string | null;
}): 0 | 1 | 2 | 3 | 4 | 5 {
  let base: number | undefined;
  if (tags.sacScale !== undefined && tags.sacScale !== null && tags.sacScale in SAC_SCALE_CLASSES) {
    base = SAC_SCALE_CLASSES[tags.sacScale];
  } else if (
    tags.highway !== undefined &&
    tags.highway !== null &&
    tags.highway in HIGHWAY_CLASSES
  ) {
    base = HIGHWAY_CLASSES[tags.highway];
  }
  if (base === undefined) base = 1;

  const surface = tags.surface?.toLowerCase();
  if (surface === 'rock' || surface === 'scree') base += 1;

  return Math.min(5, Math.max(0, base)) as 0 | 1 | 2 | 3 | 4 | 5;
}

/** Pente maximale (valeur absolue) sur des fenêtres d'au moins `MIN_GRADE_WINDOW_M`. */
function computeMaxGradePct(points: SegmentGeometryInput['points']): number {
  let maxGradePct = 0;

  for (let start = 0; start + 1 < points.length; start += 1) {
    const startEle = points[start].ele;
    if (typeof startEle !== 'number' || !Number.isFinite(startEle)) continue;

    let distanceM = 0;
    let end = start;
    while (end + 1 < points.length && distanceM < MIN_GRADE_WINDOW_M) {
      distanceM += haversineM(points[end], points[end + 1]);
      end += 1;
    }
    if (distanceM < MIN_GRADE_WINDOW_M) continue;

    const endEle = points[end].ele;
    if (typeof endEle !== 'number' || !Number.isFinite(endEle)) continue;

    const gradePct = ((endEle - startEle) / distanceM) * 100;
    maxGradePct = Math.max(maxGradePct, Math.abs(gradePct));
  }

  return maxGradePct;
}

export function computeSegmentFeatures(input: SegmentGeometryInput): SegmentFeaturesResult {
  const { points } = input;

  let lengthM = 0;
  let gainM = 0;
  let lossM = 0;

  for (let i = 1; i < points.length; i += 1) {
    lengthM += haversineM(points[i - 1], points[i]);
    const previousEle = points[i - 1].ele;
    const currentEle = points[i].ele;
    if (
      typeof previousEle === 'number' &&
      Number.isFinite(previousEle) &&
      typeof currentEle === 'number' &&
      Number.isFinite(currentEle)
    ) {
      const delta = currentEle - previousEle;
      if (delta > 0) gainM += delta;
      else if (delta < 0) lossM += -delta;
    }
  }

  const elevations = definedElevations(points);

  return {
    segmentId: input.segmentId,
    lengthM,
    gainM,
    lossM,
    meanGradePct: lengthM > 0 ? ((gainM - lossM) / lengthM) * 100 : 0,
    maxGradePct: computeMaxGradePct(points),
    altitudeMinM: elevations.length > 0 ? Math.min(...elevations) : null,
    altitudeMaxM: elevations.length > 0 ? Math.max(...elevations) : null,
    surface: input.surface ?? null,
    technicalClass: technicalClassFromTags({
      highway: input.highway,
      sacScale: input.sacScale,
      surface: input.surface,
    }),
    exposureClass: null,
    isolationClass: null,
    source: 'computed',
  };
}
