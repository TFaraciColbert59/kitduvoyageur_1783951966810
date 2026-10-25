import type { TripStep } from '../types/trip.types';

export interface TracePoint {
  lat: number;
  lng: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface ProjectedTrace {
  /** Points projetés (0..width / 0..height). */
  points: ProjectedPoint[];
  /** Polyline sérialisée pour l'attribut `points` d'un <polyline> SVG. */
  polyline: string;
  /** Chaque point d'entrée (étape) avec ses coordonnées projetées. */
  markers: ProjectedPoint[];
}

/**
 * Projection lat/lng → coordonnées SVG normalisées (pad inclus).
 * Extrait de GPXPreviewCard (projection identique, rendue réutilisable et
 * testable). null si moins de 2 points géolocalisés (pas de tracé lisible).
 */
export function projectTraceToSvg(
  raw: TracePoint[],
  width: number,
  height: number,
  padding = 10,
): ProjectedTrace | null {
  const geo = raw.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (geo.length < 2) return null;

  const lats = geo.map((p) => p.lat);
  const lngs = geo.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Aire nulle (points confondus) → fallback injectif pour éviter /0.
  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;

  const innerW = Math.max(width - padding * 2, 1);
  const innerH = Math.max(height - padding * 2, 1);

  const points = geo.map((p) => ({
    x: ((p.lng - minLng) / lngSpan) * innerW + padding,
    y: height - (((p.lat - minLat) / latSpan) * innerH + padding),
  }));

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return { points, polyline, markers: points };
}
