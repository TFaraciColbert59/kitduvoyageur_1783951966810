import { haversineDistanceKm } from '@/features/explorer-osm/domain/geometry';
import type { ElevationPoint, HikeSessionRow } from './types';

export type { ElevationPoint } from './types';

interface TimedSample {
  lat?: unknown;
  lng?: unknown;
  elevationM?: unknown;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Réduit un profil à `maxPoints` échantillons en gardant les extrémités.
 * Aucune altitude n'est interpolée ni inventée.
 */
function downsample(points: ElevationPoint[], maxPoints: number): ElevationPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const result: ElevationPoint[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}

/**
 * Profil altimétrique d'une sortie : seuls les échantillons qui portent une
 * altitude réelle comptent (`positions_timed[].elevationM`). Un échantillon
 * sans altitude est ignoré ; moins de deux mesures donnent un profil vide.
 */
export function buildElevationProfile(samples: unknown, maxPoints = 120): ElevationPoint[] {
  if (!Array.isArray(samples)) return [];
  const valid: Array<{ lat: number; lng: number; elevationM: number }> = [];
  for (const raw of samples) {
    if (!raw || typeof raw !== 'object') continue;
    const sample = raw as TimedSample;
    if (
      !isFiniteNumber(sample.lat) ||
      !isFiniteNumber(sample.lng) ||
      !isFiniteNumber(sample.elevationM)
    ) {
      continue;
    }
    valid.push({ lat: sample.lat, lng: sample.lng, elevationM: sample.elevationM });
  }
  if (valid.length < 2) return [];

  let distanceKm = 0;
  const points: ElevationPoint[] = [];
  for (let index = 0; index < valid.length; index += 1) {
    const current = valid[index];
    if (index > 0) {
      const previous = valid[index - 1];
      distanceKm += haversineDistanceKm([previous.lng, previous.lat], [current.lng, current.lat]);
    }
    points.push({
      distanceKm: Math.round(distanceKm * 100) / 100,
      elevationM: current.elevationM,
      lat: current.lat,
      lng: current.lng,
    });
  }
  return downsample(points, Math.max(2, maxPoints));
}

/**
 * Choisit la première sortie qui porte un profil d'altitude réel.
 * Comme pour la trace, la sortie la plus récente n'est pas forcément celle qui
 * a des mesures : on ne rend jamais un profil inventé.
 */
export function pickElevationProfile(
  sessions: HikeSessionRow[],
  maxPoints = 120
): ElevationPoint[] {
  for (const session of sessions) {
    const profile = buildElevationProfile(session?.positions_timed, maxPoints);
    if (profile.length >= 2) return profile;
  }
  return [];
}
