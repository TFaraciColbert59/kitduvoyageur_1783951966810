/**
 * Statistiques réelles de la fiche carnet (distance, dénivelé, jours).
 *
 * Aucune valeur n'est inventée ni répartie : une distance absente reste `null`,
 * une moyenne n'existe que si le numérateur ET le dénominateur existent.
 */

import type { CarnetEtapeDay, CarnetDetail, CarnetMomentItem } from './types';

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

/**
 * Jour extrême d'une série de distances : le numéro du jour et la distance
 * réelle qui l'a fait retenir. Les distances déclarées (`groupe_etapes`) sont
 * la source ; à défaut, les distances calculées des jours dérivés prennent le
 * relais — jamais une moyenne présentée comme un jour.
 */
export interface CarnetDayExtreme {
  dayNumber: number;
  distanceKm: number;
}

export interface CarnetDayStats {
  day: CarnetEtapeDay;
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
  daysWithDistance: CarnetEtapeDay[];
  daysWithElevation: CarnetEtapeDay[];
  maxElevationDay: CarnetEtapeDay | null;
  /** Moyenne calculée sur les seuls jours dont le dénivelé est renseigné. */
  averageElevationM: number | null;
  daysWithoutElevation: number;
  /**
   * Jours réellement documentés : ceux qui portent au moins une donnée
   * affichable (distance, dénivelé, durée ou moment). Un jour réduit à des
   * points GPS isolés compte dans `daysCount` mais pas ici.
   */
  documentedDays: number;
  /** Nombre total de moments lus sur le carnet (`summary.moments`). */
  momentsCount: number;
  /** Somme des durées réelles des jours, `null` si aucun jour n'en porte. */
  totalDurationS: number | null;
  /**
   * Allure moyenne réelle, en minutes par kilomètre : moyenne des allures
   * journalières, calculée sur les seuls jours qui portent **à la fois** une
   * durée et une distance. Aucune durée n'est divisée par un total qui ne
   * couvre pas les mêmes jours.
   */
  averagePaceMinPerKm: number | null;
  /** Jour de plus grande distance connue, `null` sans distance. */
  longestDay: CarnetDayExtreme | null;
  /** Jour de plus petite distance connue (strictement positive). */
  shortestDay: CarnetDayExtreme | null;
  days: CarnetDayStats[];
}

/** Une valeur nulle ou négative est une absence, pas un zéro affichable. */
function positive(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * D+ réel de chaque jour dérivé, quand la sortie le porte : la fiche et le
 * volet Dénivelé lisent alors le même chiffre. Une étape qui porte déjà son
 * `denivele_m` n'est jamais remplacée.
 */
function etapesWithDerivedElevation(detail: CarnetDetail): CarnetEtapeDay[] {
  const derived = new Map<number, number>();
  for (const day of detail.days ?? []) {
    if (positive(day.elevationM) !== null) derived.set(day.index, day.elevationM as number);
  }
  if (derived.size === 0) return detail.etapes;
  return detail.etapes.map((etape) => {
    if (positive(etape.elevationM) !== null) return etape;
    const value = derived.get(etape.dayNumber);
    return value === undefined ? etape : { ...etape, elevationM: value };
  });
}

export function summarizeCarnet(detail: CarnetDetail): CarnetStatsSummary {
  const distanceKm = positive(detail.distanceKm);
  const elevationM = positive(detail.elevationM);
  const days = etapesWithDerivedElevation(detail);
  const daysCount = days.length;

  const averageDistanceKm =
    distanceKm !== null && daysCount > 0 ? distanceKm / daysCount : null;
  const elevationPerKm =
    elevationM !== null && distanceKm !== null ? elevationM / distanceKm : null;

  const daysWithDistance = days.filter((day) => positive(day.distanceKm) !== null);
  const daysWithElevation = days.filter((day) => positive(day.elevationM) !== null);

  let maxElevationDay: CarnetEtapeDay | null = null;
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

  /* Jours dérivés (`buildDays`) : seuls eux portent la durée réelle et les
     moments, donc c'est sur eux que se calculent la durée totale et la part
     documentée. Aucune valeur n'est répartie depuis les totaux. */
  const derivedDays = detail.days ?? [];
  let documentedDays = 0;
  let totalDurationS: number | null = null;
  let paceSum = 0;
  let paceCount = 0;
  for (const day of derivedDays) {
    if (
      day.distanceKm !== null ||
      day.elevationM !== null ||
      day.durationS !== null ||
      day.moments.length > 0
    ) {
      documentedDays += 1;
    }
    if (day.durationS !== null && Number.isFinite(day.durationS) && day.durationS >= 0) {
      totalDurationS = (totalDurationS ?? 0) + day.durationS;
    }
    /* Allure du jour : seulement quand la durée et la distance du même jour
       existent. La moyenne porte sur ces jours-là, jamais sur le carnet. */
    if (
      day.durationS !== null &&
      Number.isFinite(day.durationS) &&
      day.durationS > 0 &&
      day.distanceKm !== null &&
      Number.isFinite(day.distanceKm) &&
      day.distanceKm > 0
    ) {
      paceSum += day.durationS / 60 / day.distanceKm;
      paceCount += 1;
    }
  }
  const averagePaceMinPerKm = paceCount > 0 ? paceSum / paceCount : null;

  /* Jour le plus long et le plus court : parmi les seules distances connues,
     jamais une valeur déduite d'une moyenne. */
  const declaredDistances: CarnetDayExtreme[] = daysWithDistance.map((day) => ({
    dayNumber: day.dayNumber,
    distanceKm: positive(day.distanceKm) as number,
  }));
  /* Les bornes ne mélangent jamais deux sources : seules les distances
     **déclarées** (`groupe_etapes.distance_km`) sont comparées. Une distance
     déduite du tracé reste dans le volet Distance, sous « trace gps » — elle
     n'est pas promue en « jour le plus long », qui contredirait le total. */
  let longestDay: CarnetDayExtreme | null = null;
  let shortestDay: CarnetDayExtreme | null = null;
  for (const day of declaredDistances) {
    if (longestDay === null || day.distanceKm > longestDay.distanceKm) longestDay = day;
    if (shortestDay === null || day.distanceKm < shortestDay.distanceKm) shortestDay = day;
  }

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
    documentedDays,
    averagePaceMinPerKm,
    momentsCount: detail.summary?.moments ?? detail.moments.length,
    totalDurationS,
    longestDay,
    shortestDay,
    days: days.map((day) => ({
      day,
      moments: detail.moments.filter((moment) => moment.dayNumber === day.dayNumber),
    })),
  };
}
