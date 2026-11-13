/**
 * Lot A02 — projection de la trace pour l'aperçu de recadrage / fractionnement.
 *
 * Fonctions pures, sans état : la même géométrie donne toujours le même tracé,
 * ce qui rend les aperçus comparables avant/après. Aucune altitude n'est
 * inventée : sans altitude mesurée, le profil est un axe neutre.
 */

import type { LifecyclePoint } from '@/features/activity/lifecycle';

export interface TraceGeometry {
  /** Chemin SVG de la trace. */
  path: string;
  /** Aire fermée sous la trace, pour le remplissage. */
  area: string;
  minElevationM: number | null;
  maxElevationM: number | null;
  hasElevation: boolean;
  /** Distance cumulée en mètres (dernier point = longueur de la trace). */
  totalDistanceM: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

export function haversineM(a: LifecyclePoint, b: LifecyclePoint): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cumulativeDistances(points: readonly LifecyclePoint[]): number[] {
  if (points.length === 0) return [];
  const result: number[] = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineM(points[index - 1], points[index]);
    result.push(total);
  }
  return result;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Projette une trace dans une boîte SVG. L'axe horizontal suit la distance
 * cumulée quand elle est disponible (sinon l'indice), l'axe vertical l'altitude
 * (sinon l'indice, pour conserver une pente lisible).
 */
export function buildTraceGeometry(
  points: readonly LifecyclePoint[],
  width: number,
  height: number,
  padding = 6
): TraceGeometry {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const pad = Math.max(0, Math.min(padding, safeWidth / 4, safeHeight / 4));
  const innerWidth = Math.max(1, safeWidth - pad * 2);
  const innerHeight = Math.max(1, safeHeight - pad * 2);

  if (points.length === 0) {
    return {
      path: '',
      area: '',
      minElevationM: null,
      maxElevationM: null,
      hasElevation: false,
      totalDistanceM: 0,
    };
  }

  const distances = cumulativeDistances(points);
  const totalDistanceM = distances[distances.length - 1] ?? 0;
  const elevations = points
    .map((point) => point.elevationM)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const hasElevation = elevations.length >= 2;
  const minElevationM = hasElevation ? Math.min(...elevations) : null;
  const maxElevationM = hasElevation ? Math.max(...elevations) : null;
  const elevationSpan =
    hasElevation && maxElevationM !== null && minElevationM !== null
      ? Math.max(1, maxElevationM - minElevationM)
      : 1;

  const coords = points.map((point, index) => {
    const ratio =
      totalDistanceM > 0
        ? distances[index] / totalDistanceM
        : index / Math.max(1, points.length - 1);
    const x = pad + ratio * innerWidth;
    const elevation = point.elevationM;
    const y =
      hasElevation && typeof elevation === 'number'
        ? pad + (1 - (elevation - (minElevationM ?? 0)) / elevationSpan) * innerHeight
        : pad + (index / Math.max(1, points.length - 1)) * innerHeight;
    return { x: round(x, 2), y: round(y, 2) };
  });

  const path = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = `${path} L${last.x} ${safeHeight - pad} L${first.x} ${safeHeight - pad} Z`;

  return {
    path,
    area,
    minElevationM,
    maxElevationM,
    hasElevation,
    totalDistanceM: Math.round(totalDistanceM),
  };
}

/** Indice de point le plus proche d'un ratio [0..1] de la trace. */
export function ratioToPointIndex(points: readonly LifecyclePoint[], ratio: number): number {
  if (points.length === 0) return 0;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const distances = cumulativeDistances(points);
  const total = distances[distances.length - 1] ?? 0;
  if (total <= 0) {
    return Math.round(clamped * (points.length - 1));
  }
  const target = clamped * total;
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let index = 0; index < distances.length; index += 1) {
    const delta = Math.abs(distances[index] - target);
    if (delta < bestDelta) {
      best = index;
      bestDelta = delta;
    }
  }
  return best;
}

/** Ratio [0..1] de la distance cumulée à un indice donné. */
export function pointIndexToRatio(points: readonly LifecyclePoint[], index: number): number {
  if (points.length <= 1) return 0;
  const clamped = Math.min(points.length - 1, Math.max(0, Math.round(index)));
  const distances = cumulativeDistances(points);
  const total = distances[distances.length - 1] ?? 0;
  if (total <= 0) return clamped / (points.length - 1);
  return distances[clamped] / total;
}

/**
 * Vrai lorsque la géométrie active diffère de la trace brute d'origine.
 * Sert à proposer « Restaurer la trace d'origine » sans supposer une
 * transformation qui n'a pas eu lieu.
 */
export function hasGeometryChanges(record: {
  points: readonly LifecyclePoint[];
  originalPoints: readonly LifecyclePoint[];
}): boolean {
  if (record.points.length !== record.originalPoints.length) return true;
  if (record.points.length === 0) return false;
  const first = record.points[0];
  const last = record.points[record.points.length - 1];
  const originalFirst = record.originalPoints[0];
  const originalLast = record.originalPoints[record.originalPoints.length - 1];
  return (
    first.lat !== originalFirst.lat ||
    first.lng !== originalFirst.lng ||
    last.lat !== originalLast.lat ||
    last.lng !== originalLast.lng
  );
}

/** Distance cumulée au point d'indice `index` (m). */
export function distanceAtIndex(points: readonly LifecyclePoint[], index: number): number {
  if (points.length === 0) return 0;
  const distances = cumulativeDistances(points);
  return distances[Math.min(points.length - 1, Math.max(0, Math.round(index)))] ?? 0;
}
