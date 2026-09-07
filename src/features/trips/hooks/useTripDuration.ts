import { useMemo } from 'react';
import { getTripPhaseDetails } from '../engine/temporalPhaseEngine';
import { getCivilDurationDays } from '@/lib/dates/tripDates';

/**
 * Sélecteur unique de la DURÉE d'un voyage (Règle Z-R3).
 *
 * Résout le défaut Z-D20 : la durée affichée variait selon l'onglet
 * (header, Aperçu, Vivre, pastille, Checklist) car certains calculaient
 * depuis les étapes (max day_number) et d'autres depuis les dates.
 *
 * Source de vérité CANONIQUE : les dates start_date -> end_date (inclusives).
 * Fallback : le day_number maximal des étapes, puis 1.
 * daysUntilDeparture et currentDay sont délégués au moteur temporel canonique
 * (getTripPhaseDetails) pour garantir la cohérence avec la pastille de phase.
 */

export interface TripDurationInput {
  start_date?: string | null;
  end_date?: string | null;
  steps?: { day_number: number }[];
}

export interface TripDuration {
  /** Nombre total de jours du voyage (bornes incluses). */
  durationDays: number;
  /** Jours restants avant le départ (0 si parti / sans date). */
  daysUntilDeparture: number;
  /** Jour courant pendant la phase 'live', null sinon. */
  currentDay: number | null;
}

export function getTripDuration(
  trip: TripDurationInput,
  now?: Date | string
): TripDuration {
  let durationDays = 1;

  if (trip.start_date && trip.end_date) {
    const fromDates = getCivilDurationDays(trip.start_date, trip.end_date);
    if (fromDates > 0) durationDays = fromDates;
  }

  if (durationDays <= 1 && Array.isArray(trip.steps) && trip.steps.length > 0) {
    const maxDay = Math.max(...trip.steps.map((s) => Number(s.day_number) || 1));
    durationDays = Math.max(maxDay, 1);
  }

  const phase = getTripPhaseDetails(trip, now);

  return {
    durationDays,
    daysUntilDeparture: phase.daysUntilStart ?? 0,
    currentDay: phase.dayIndex,
  };
}

export function useTripDuration(
  trip: TripDurationInput,
  now?: Date | string
): TripDuration {
  return useMemo(() => getTripDuration(trip, now), [trip, now]);
}
