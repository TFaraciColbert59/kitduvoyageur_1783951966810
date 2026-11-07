import { boundsOf, isValidPoint, simplifyTrack } from '@/features/compte/map/geometry';
import type { MapBounds, TrackPoint } from '@/features/compte/map/types';
import type { CarnetDay, CarnetDayPoint } from '@/features/carnet/detail/types';

/**
 * Cadrage de la carte du bas selon la page affichée en haut de la fiche.
 * Page 0 = Résumé global, page n = jour n. Module pur : aucune valeur inventée,
 * un jour sans tracé exploitable ne produit ni ligne, ni point, ni bornes.
 */

/** Ramène une page à une valeur valide : 0 (Résumé) ... nombre de jours. */
export function clampDayPage(page: number, dayCount: number): number {
  const last = Math.max(0, Math.trunc(dayCount));
  if (!Number.isFinite(page)) return 0;
  return Math.max(0, Math.min(last, Math.trunc(page)));
}

/** Jour de la page, ou `null` pour le Résumé (et pour une page hors bornes sans jour). */
export function dayForPage(days: readonly CarnetDay[] | null | undefined, page: number): CarnetDay | null {
  const list = days ?? [];
  const index = clampDayPage(page, list.length);
  return index === 0 ? null : (list[index - 1] ?? null);
}

/** Ce que la carte doit dessiner pour un jour qui a un vrai tracé. */
export interface DayMapFocus {
  /** Ligne du jour (simplifiée comme le tracé global), au moins 2 points. */
  line: TrackPoint[];
  /** Premier et dernier point réels du jour, tels que relevés. */
  start: TrackPoint;
  end: TrackPoint;
  /** Bornes [ouest, sud, est, nord] de la ligne du jour. */
  bounds: MapBounds;
}

/**
 * Focus d'un jour. `null` = rien à mettre en avant : soit le Résumé
 * (`points` absent), soit un jour sans au moins deux points distincts valides.
 * L'appelant distingue les deux cas par `points === null | undefined`.
 */
export function dayMapFocus(points: readonly CarnetDayPoint[] | null | undefined): DayMapFocus | null {
  if (!points) return null;
  const valid: TrackPoint[] = [];
  for (const point of points) {
    if (point && isValidPoint(point.lng, point.lat)) valid.push({ lng: point.lng, lat: point.lat });
  }
  const line = simplifyTrack(valid);
  if (line.length < 2) return null;
  const bounds = boundsOf(line);
  if (!bounds) return null;
  return { line, start: valid[0], end: valid[valid.length - 1], bounds };
}

/** La page est-elle un jour (et non le Résumé) ? Pilote l'atténuation du tracé global. */
export function isDayHighlight(points: readonly CarnetDayPoint[] | null | undefined): boolean {
  return Array.isArray(points);
}
