import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * H-ACT — Types d'activité du hub universel.
 *
 * Le hub compose son interface selon l'activité active (phase 1 : randonnée
 * et voyage). Ajouter une activité (course, natation, vélo…) = étendre cette
 * union, déclarer ses widgets dans widgetCatalog et fournir un adaptateur de
 * données — la coquille, la navigation et le moteur restent identiques.
 *
 * Fonctions PURES : zéro React, zéro horloge interne, `now` injecté.
 */

/** Types d'activité pris en charge (phase 1). Extensible phase 2+. */
export type ActivityType = 'travel' | 'hiking';

/** Activités `primary_activity` d'un voyage considérées comme randonnée. */
const HIKING_ACTIVITIES: ReadonlySet<string> = new Set([
  'hiking',
  'trekking',
  'bivouac',
  'bushcraft',
]);

/**
 * Dérive le type d'activité d'un voyage à partir de son `primary_activity`.
 * Défaut prudent : `travel` (non-hiking).
 */
export function deriveActivityType(
  primaryActivity: TripFull['primary_activity'] | null | undefined,
): ActivityType {
  return primaryActivity && HIKING_ACTIVITIES.has(primaryActivity) ? 'hiking' : 'travel';
}

/** Durée estimée d'une randonnée (minutes) — règle de Naismith (hors pauses). */
export function estimateHikeDurationMin(distanceKm: number, elevationGainM: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) distanceKm = 0;
  if (!Number.isFinite(elevationGainM) || elevationGainM < 0) elevationGainM = 0;
  const walkingMin = (distanceKm / 4.8) * 60; // 4,8 km/h de marche
  const ascentMin = (elevationGainM / 600) * 60; // 600 m/h d'ascension
  return Math.round(walkingMin + ascentMin);
}

/** Formatte une durée en minutes vers « H h MM min ». */
export function formatHikeDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/**
 * Aggrège distance + dénivelés depuis les étapes d'un voyage
 * (source : trip.steps). Retourne des nuls si aucune étape exploitable.
 */
export function aggregateHikeStats(steps: TripFull['steps']): {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  hasData: boolean;
} {
  if (!steps || steps.length === 0) {
    return { distanceKm: 0, elevationGainM: 0, elevationLossM: 0, hasData: false };
  }
  let distanceKm = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  for (const s of steps) {
    if (s.distance_km != null) distanceKm += s.distance_km;
    if (s.elevation_gain_m != null) elevationGainM += s.elevation_gain_m;
    if (s.elevation_loss_m != null) elevationLossM += s.elevation_loss_m;
  }
  return { distanceKm, elevationGainM, elevationLossM, hasData: distanceKm > 0 || elevationGainM > 0 };
}