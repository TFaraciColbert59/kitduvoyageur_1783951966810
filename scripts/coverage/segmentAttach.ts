/**
 * Phase 4 — Étape 7 du pipeline : rattachement des parcours aux segments réels.
 *
 * Le pipeline ne crée JAMAIS de segments : il rattache un parcours importé aux
 * segments existants (`trail_segments`) fournis en entrée. Un point sans
 * segment à portée est signalé (non rattaché), jamais remplacé par une
 * estimation.
 */
import type { LatLng, NormalizedRoute } from './types';
import { haversineMeters } from './metrics';

export interface SegmentRef {
  id: number;
  points: readonly LatLng[];
}

export interface SegmentAttachment {
  segmentIds: number[];
  matchedPoints: number;
  unmatchedPoints: number;
  matchRatio: number;
}

const DEFAULT_MAX_DISTANCE_M = 75;

/**
 * Distance point → segment en projection équirectangulaire locale.
 * Approximation suffisante à l'échelle d'un sentier ; pas d'estimation de
 * géométrie navigable, uniquement une mesure de proximité.
 */
export function distancePointToSegmentM(point: LatLng, a: LatLng, b: LatLng): number {
  const referenceLat = toRadians(point.lat);
  const project = (candidate: LatLng) => ({
    x: toRadians(candidate.lng - point.lng) * Math.cos(referenceLat) * 6_371_008.8,
    y: toRadians(candidate.lat - point.lat) * 6_371_008.8,
  });

  const projectedA = project(a);
  const projectedB = project(b);
  const dx = projectedB.x - projectedA.x;
  const dy = projectedB.y - projectedA.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return haversineMeters(point, a);
  }

  const t = Math.max(
    0,
    Math.min(1, -(projectedA.x * dx + projectedA.y * dy) / lengthSquared)
  );
  const closest = {
    x: projectedA.x + t * dx,
    y: projectedA.y + t * dy,
  };
  return Math.hypot(closest.x, closest.y);
}

function distanceToSegmentM(point: LatLng, segment: SegmentRef): number {
  if (segment.points.length === 0) return Number.POSITIVE_INFINITY;
  if (segment.points.length === 1) return haversineMeters(point, segment.points[0]);

  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < segment.points.length; index += 1) {
    const distance = distancePointToSegmentM(point, segment.points[index - 1], segment.points[index]);
    if (distance < best) best = distance;
  }
  return best;
}

export function attachRouteToSegments(
  route: NormalizedRoute,
  segments: readonly SegmentRef[],
  maxDistanceM: number = DEFAULT_MAX_DISTANCE_M
): SegmentAttachment {
  const segmentIds = new Set<number>();
  let matchedPoints = 0;

  for (const point of route.points) {
    let matched = false;
    for (const segment of segments) {
      if (distanceToSegmentM(point, segment) <= maxDistanceM) {
        segmentIds.add(segment.id);
        matched = true;
      }
    }
    if (matched) matchedPoints += 1;
  }

  const total = route.points.length;
  return {
    segmentIds: [...segmentIds].sort((left, right) => left - right),
    matchedPoints,
    unmatchedPoints: total - matchedPoints,
    matchRatio: total === 0 ? 0 : Math.round((matchedPoints / total) * 1000) / 1000,
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
