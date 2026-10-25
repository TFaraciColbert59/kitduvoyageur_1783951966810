/**
 * Échantillonnage des points de map-matching (A10 — 10.6).
 *
 * Le map-matching batch envoie toute la trace à `a2_match_track_candidates`.
 * Pour borner la charge PostGIS, seuls des points régulièrement espacés sont
 * envoyés : 1 point / ~25 m, plafond 2 000 points, premier et dernier toujours
 * conservés. Les candidats obtenus sont ensuite appliqués à toute la trace
 * (le point échantillonné le plus proche en arrière), afin de préserver les
 * durées et distances réelles des passages.
 *
 * Moteur pur (ADR-AI-005) : aucune I/O, testable.
 */
import { haversineM } from './geo';

export const MATCH_SAMPLING_DEFAULTS = {
  /** Plafond de points envoyés à la RPC batch. */
  maxPoints: 2_000,
  /** Espacement cible entre deux points de matching (mètres). */
  stepM: 25,
} as const;

export interface SamplingOptions {
  maxPoints?: number;
  stepM?: number;
}

export interface MatchingSample<T extends { lat: number; lng: number }> {
  /** Points retenus, dans l'ordre de la trace. */
  points: T[];
  /** Indices d'origine des points retenus (croissants). */
  indices: number[];
  /** Pas appliqué sur la trace d'origine. */
  stride: number;
}

/**
 * Sélectionne « premier/dernier + pas régulier » bornée par `maxPoints`.
 * Le pas combine l'espacement cible (`stepM`) et le plafond de points.
 */
export function selectMatchingPoints<T extends { lat: number; lng: number }>(
  points: T[],
  options: SamplingOptions = {}
): MatchingSample<T> {
  const maxPoints = Math.max(1, Math.trunc(options.maxPoints ?? MATCH_SAMPLING_DEFAULTS.maxPoints));
  const stepM = Math.max(1, options.stepM ?? MATCH_SAMPLING_DEFAULTS.stepM);
  const count = points.length;

  if (count <= 1) {
    return { points: [...points], indices: points.map((_, index) => index), stride: 1 };
  }

  let totalDistanceM = 0;
  for (let index = 1; index < count; index += 1) {
    totalDistanceM += haversineM(points[index - 1], points[index]);
  }
  const spacingM = totalDistanceM / (count - 1);

  const capStride = Math.ceil(count / maxPoints);
  const distanceStride = spacingM > 0 ? Math.ceil(stepM / spacingM) : 1;
  const stride = Math.max(1, capStride, distanceStride);

  const indices: number[] = [];
  for (let index = 0; index < count; index += stride) {
    indices.push(index);
  }
  if (indices[indices.length - 1] !== count - 1) {
    if (indices.length >= maxPoints) indices.pop();
    indices.push(count - 1);
  }

  return { points: indices.map((index) => points[index]), indices, stride };
}

/**
 * Étale les candidats d'un échantillon sur toute la trace : chaque point
 * d'origine reçoit les candidats du point échantillonné précédent.
 */
export function expandSampleCandidates<T>(
  sample: MatchingSample<{ lat: number; lng: number }>,
  candidates: T[][],
  totalPoints: number
): T[][] {
  const perPoint: T[][] = new Array(totalPoints);
  let cursor = 0;
  for (let index = 0; index < totalPoints; index += 1) {
    while (cursor + 1 < sample.indices.length && sample.indices[cursor + 1] <= index) {
      cursor += 1;
    }
    perPoint[index] = candidates[cursor] ?? [];
  }
  return perPoint;
}
