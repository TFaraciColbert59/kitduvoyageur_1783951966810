import type { GeoPoint, StreetViewProvider, StreetViewResult } from '../types';
import { isValidPoint } from '../privacy';
import { directionFromHeading, haversineM } from './geometry';

/**
 * K2.25 — vue de rue au point choisi, orientée selon le déplacement.
 *
 * Aucun fournisseur n'est appelé ici : l'adaptateur (Google, Mapillary, etc.)
 * est injecté. Sans adaptateur, la réponse est `provider-absent` et l'UI
 * propose la galerie Trail View. Aucune clé n'est codée en dur.
 */
export function resolveStreetView(
  point: GeoPoint,
  travelHeadingDeg: number,
  provider: StreetViewProvider | null,
  maxDistanceM = 50
): StreetViewResult {
  if (!isValidPoint(point)) {
    return {
      available: false,
      panoId: null,
      headingDeg: null,
      direction: null,
      distanceM: null,
      reason: 'invalid-point',
    };
  }
  if (!provider) {
    return {
      available: false,
      panoId: null,
      headingDeg: null,
      direction: null,
      distanceM: null,
      reason: 'provider-absent',
    };
  }

  let coverage;
  try {
    coverage = provider.lookup(point, maxDistanceM);
  } catch {
    coverage = null;
  }
  if (!coverage || !isValidPoint(coverage.point)) {
    return {
      available: false,
      panoId: null,
      headingDeg: null,
      direction: null,
      distanceM: null,
      reason: 'no-coverage',
    };
  }

  const distanceM = haversineM(point, coverage.point);
  if (distanceM > maxDistanceM) {
    return {
      available: false,
      panoId: null,
      headingDeg: null,
      direction: null,
      distanceM: null,
      reason: 'no-coverage',
    };
  }

  return {
    available: true,
    panoId: coverage.panoId,
    headingDeg: Math.round(coverage.headingDeg),
    direction: directionFromHeading(coverage.headingDeg, travelHeadingDeg),
    distanceM: Math.round(distanceM * 10) / 10,
    reason: 'ok',
  };
}
