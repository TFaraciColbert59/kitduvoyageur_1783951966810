import { cubicBezierEasing } from '@/components/map/engine/camera';

/**
 * Tracé et vol de caméra d'**un jour** de carnet.
 *
 * Le carnet se balaie Résumé → J1 → Jn : la carte du bas doit peindre le seul
 * segment du jour affiché et voler vers lui. Ce module est la seule source de
 * ces deux décisions — aucune coordonnée n'est inventée, aucun jour sans point
 * GPS ne fabrique un tracé.
 */

/** Point GPS du jour, tel que `CarnetDay.points` le porte. */
export interface DayPoint {
  lat: number;
  lng: number;
}

/** Durée du vol vers le segment d'un jour, en ms. */
export const DAY_FLIGHT_MS = 900;

/** Courbe du vol : `cubic-bezier(.22, 1, .36, 1)`, celle des surfaces LKDV. */
export const DAY_FLIGHT_BEZIER = [0.22, 1, 0.36, 1] as const;

/** Inclinaison du cadrage d'un segment : la 3D de la carte d'une sortie. */
export const DAY_FLIGHT_PITCH = 45;

/** Vol transmis à `CompteMap` : identifiant stable, durée, courbe, inclinaison. */
export interface DayTraceFlight {
  key: string;
  duration: number;
  easing: (progress: number) => number;
  pitch: number;
}

/** Clé de cadrage de la page « Résumé » (tracé complet, caméra sur tout le carnet). */
export const SUMMARY_FOCUS_KEY = 'resume';

/** Clé de cadrage d'un jour : `j1`, `j2`…, dérivée du numéro réel du jour. */
export function dayFocusKey(index: number | null | undefined): string {
  return typeof index === 'number' && Number.isFinite(index) && index >= 1
    ? `j${Math.round(index)}`
    : SUMMARY_FOCUS_KEY;
}

function isValidPoint(point: DayPoint | null | undefined): point is DayPoint {
  return (
    Boolean(point) &&
    typeof point?.lat === 'number' &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/**
 * Tracé GeoJSON du segment d'un jour.
 *
 * `null` en entrée = Résumé : on rend le tracé **complet** du carnet, tel quel.
 * Un tableau de moins de deux points valides = journée sans parcours : `null`,
 * donc l'état vide honnête de la carte, jamais un tracé emprunté au carnet.
 */
export function dayTrace(trace: unknown, dayPoints: DayPoint[] | null | undefined): unknown | null {
  if (dayPoints === null) return trace ?? null;
  if (!Array.isArray(dayPoints)) return null;
  const coordinates = dayPoints
    .filter((point) => isValidPoint(point))
    .map((point) => [point.lng, point.lat] as [number, number]);
  if (coordinates.length < 2) return null;
  return { type: 'LineString' as const, coordinates };
}

/**
 * Vol de caméra de la page affichée. Mémorisable tel quel : la courbe est
 * construite une fois par clé, et deux rendus d'une même page donnent le même
 * objet — la caméra ne rejoue donc jamais sans changement de page.
 */
export function dayTraceFlight(focusKey: string): DayTraceFlight {
  return {
    key: focusKey,
    duration: DAY_FLIGHT_MS,
    easing: cubicBezierEasing(...DAY_FLIGHT_BEZIER),
    pitch: DAY_FLIGHT_PITCH,
  };
}
