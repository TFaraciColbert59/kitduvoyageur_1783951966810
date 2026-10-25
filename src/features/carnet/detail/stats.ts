/**
 * Statistiques réelles de la fiche carnet (distance, dénivelé, jours).
 *
 * Aucune valeur n'est inventée ni répartie : une distance absente reste `null`,
 * une moyenne n'existe que si le numérateur ET le dénominateur existent.
 */

import type { CarnetDay, CarnetDetail, CarnetMomentItem } from './types';

export type CarnetStatsTab = 'distance' | 'elevation' | 'days';

export interface CarnetStatsTabItem {
  id: CarnetStatsTab;
  label: string;
}

/** Ordre imposé par le contrat de refonte. */
export const CARNET_STATS_TABS: CarnetStatsTabItem[] = [
  { id: 'distance', label: 'Distance' },
  { id: 'elevation', label: 'Dénivelé' },
  { id: 'days', label: 'Jours' },
];

export interface CarnetDayStats {
  day: CarnetDay;
  moments: CarnetMomentItem[];
}

export interface CarnetStatsSummary {
  distanceKm: number | null;
  elevationM: number | null;
  daysCount: number;
  /** Moyenne réelle : distance totale ÷ nombre de jours. */
  averageDistanceKm: number | null;
  /** Dénivelé positif par kilomètre (m/km), si les deux totaux existent. */
  elevationPerKm: number | null;
  startPlace: string | null;
  endPlace: string | null;
  daysWithDistance: CarnetDay[];
  daysWithElevation: CarnetDay[];
  maxElevationDay: CarnetDay | null;
  /** Moyenne calculée sur les seuls jours dont le dénivelé est renseigné. */
  averageElevationM: number | null;
  daysWithoutElevation: number;
  days: CarnetDayStats[];
}

/** Une valeur nulle ou négative est une absence, pas un zéro affichable. */
function positive(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

export function summarizeCarnet(detail: CarnetDetail): CarnetStatsSummary {
  const distanceKm = positive(detail.distanceKm);
  const elevationM = positive(detail.elevationM);
  const days = detail.days;
  const daysCount = days.length;

  const averageDistanceKm =
    distanceKm !== null && daysCount > 0 ? distanceKm / daysCount : null;
  const elevationPerKm =
    elevationM !== null && distanceKm !== null ? elevationM / distanceKm : null;

  const daysWithDistance = days.filter((day) => positive(day.distanceKm) !== null);
  const daysWithElevation = days.filter((day) => positive(day.elevationM) !== null);

  let maxElevationDay: CarnetDay | null = null;
  let elevationSum = 0;
  for (const day of daysWithElevation) {
    const value = positive(day.elevationM) as number;
    elevationSum += value;
    if (maxElevationDay === null || value > (positive(maxElevationDay.elevationM) as number)) {
      maxElevationDay = day;
    }
  }
  const averageElevationM = daysWithElevation.length > 0 ? elevationSum / daysWithElevation.length : null;

  const firstDay = days[0] ?? null;
  const lastDay = days[daysCount - 1] ?? null;

  return {
    distanceKm,
    elevationM,
    daysCount,
    averageDistanceKm,
    elevationPerKm,
    startPlace: firstDay?.from ?? null,
    endPlace: lastDay?.to ?? null,
    daysWithDistance,
    daysWithElevation,
    maxElevationDay,
    averageElevationM,
    daysWithoutElevation: daysCount - daysWithElevation.length,
    days: days.map((day) => ({
      day,
      moments: detail.moments.filter((moment) => moment.dayNumber === day.dayNumber),
    })),
  };
}
