/**
 * Phase 4 — Étape 6 du pipeline : distance, D+/D- et difficulté.
 * Fonctions pures et déterministes (Haversine, lissage du bruit altimétrique).
 */
import type { Difficulty, LatLng, RouteMetrics } from './types';

const EARTH_RADIUS_M = 6_371_008.8;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Difficulté interne, dérivée uniquement des mesures réelles. Ce n'est PAS
 * une cotation officielle (SAC/IGN) : elle sert au tri et à la couverture.
 * Sans altitude, la difficulté reste `unknown` — jamais inventée.
 */
export function classifyDifficulty(
  distanceKm: number,
  elevationGainM: number | null
): Difficulty {
  if (elevationGainM === null) return 'unknown';
  if (distanceKm <= 8 && elevationGainM <= 300) return 'easy';
  if (distanceKm <= 15 && elevationGainM <= 800) return 'moderate';
  if (distanceKm <= 25 && elevationGainM <= 1500) return 'hard';
  return 'expert';
}

export interface MetricsOptions {
  /** Seuil de bruit altimétrique ignoré (m). */
  elevationNoiseM?: number;
  /** Nombre de points ignorés pour stabiliser les extrémités GPS. */
  edgeTrim?: number;
}

export function computeRouteMetrics(
  points: readonly LatLng[],
  options: MetricsOptions = {}
): RouteMetrics {
  const noise = options.elevationNoiseM ?? 5;
  const edgeTrim = options.edgeTrim ?? 0;

  if (points.length < 2) {
    return { distanceKm: 0, elevationGainM: null, elevationLossM: null, difficulty: 'unknown' };
  }

  const start = Math.min(edgeTrim, points.length - 2);
  const end = Math.max(points.length - 1 - edgeTrim, start + 1);
  const trimmed = points.slice(start, end + 1);

  let distanceMeters = 0;
  let gain = 0;
  let loss = 0;
  let hasElevation = false;

  for (let index = 1; index < trimmed.length; index += 1) {
    const previous = trimmed[index - 1];
    const current = trimmed[index];
    distanceMeters += haversineMeters(previous, current);

    if (typeof previous.ele === 'number' && typeof current.ele === 'number') {
      hasElevation = true;
      const delta = current.ele - previous.ele;
      if (delta > noise) gain += delta;
      else if (delta < -noise) loss += Math.abs(delta);
    }
  }

  const distanceKm = Math.round((distanceMeters / 1000) * 1000) / 1000;
  const elevationGainM = hasElevation ? Math.round(gain) : null;
  const elevationLossM = hasElevation ? Math.round(loss) : null;

  return {
    distanceKm,
    elevationGainM,
    elevationLossM,
    difficulty: classifyDifficulty(distanceKm, elevationGainM),
  };
}
