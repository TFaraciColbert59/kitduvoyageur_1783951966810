import { useMemo } from 'react';
import type { TripFull, TripStep } from '../types/trip.types';
import type { TripKitAnalysis } from '../types/kit.types';

export interface TripCounters {
  itinerary: number;
  gearItems: number;
  gearGapsTotal: number;
  gearVitalGaps: number;
  budget: number;
  team: number;
  documents: number;
  /** Nombre total de participants (owner + collaborateurs uniques). Z-D23 */
  participantsCount: number;
}

/**
 * Étapes canoniques d'un voyage : dédupliquées par day_number.
 * Résout le défaut Z-D26 (deux étapes « JOUR 1 ») en ne conservant qu'une
 * étape par jour (la première dans l'ordre d'index).
 */
export function getCanonicalTripSteps(
  steps: TripStep[] | undefined | null
): TripStep[] {
  const list = Array.isArray(steps) ? steps : [];
  const sorted = [...list].sort(
    (a, b) =>
      (a.order_index ?? 0) - (b.order_index ?? 0) ||
      (a.day_number ?? 0) - (b.day_number ?? 0)
  );

  const seen = new Set<number>();
  return sorted.filter((s) => {
    const day = Number(s.day_number) || 1;
    if (seen.has(day)) return false;
    seen.add(day);
    return true;
  });
}

/**
 * Nombre de participants : ensemble unique des user_id des collaborateurs
 * UNION avec le créateur (trips.user_id). Résout Z-D23 en neutralisant le
 * double comptage quand l'owner est aussi présent dans trip_collaborators.
 */
function getParticipantsCount(trip: TripFull): number {
  const ids = new Set<string>();
  if (trip.user_id) ids.add(trip.user_id);
  for (const c of Array.isArray(trip.collaborators) ? trip.collaborators : []) {
    if (c.user_id) ids.add(c.user_id);
  }
  return Math.max(ids.size, 1);
}

/**
 * Sélecteur déterministe et unique des compteurs d'un voyage.
 * Résout les défauts D5 et D6 en dérivant les compteurs strictement
 * depuis les données réelles rendues, sans aucun chiffre en dur dans le JSX.
 * Résout D22 (compteur d'étapes) et D23 (participants) en source de vérité unique.
 */
export function getTripCounters(
  trip: TripFull,
  analysis?: TripKitAnalysis | null
): TripCounters {
  const canonicalSteps = getCanonicalTripSteps(trip.steps);
  const itemsCount = Array.isArray(trip.items) ? trip.items.length : 0;
  const expensesCount = Array.isArray(trip.expenses) ? trip.expenses.length : 0;
  const participantsCount = getParticipantsCount(trip);
  const documentsCount = Array.isArray(trip.documents) ? trip.documents.length : 0;

  const vitalGaps = analysis?.vitalGaps?.length || 0;
  const recommendedGaps = analysis?.recommendedGaps?.length || 0;
  const gearGapsTotal = vitalGaps + recommendedGaps;

  return {
    itinerary: canonicalSteps.length,
    gearItems: itemsCount,
    gearGapsTotal,
    gearVitalGaps: vitalGaps,
    budget: expensesCount,
    team: participantsCount,
    documents: documentsCount,
    participantsCount,
  };
}

/**
 * Hook React mémorisant les compteurs dérivés du voyage
 */
export function useTripCounters(
  trip: TripFull,
  analysis?: TripKitAnalysis | null
): TripCounters {
  return useMemo(
    () => getTripCounters(trip, analysis),
    [trip, analysis]
  );
}
