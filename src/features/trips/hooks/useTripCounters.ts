import { useMemo } from 'react';
import type { TripFull } from '../types/trip.types';
import type { TripKitAnalysis } from '../types/kit.types';

export interface TripCounters {
  itinerary: number;
  gearItems: number;
  gearGapsTotal: number;
  gearVitalGaps: number;
  budget: number;
  team: number;
  documents: number;
}

/**
 * Sélecteur déterministe et unique des compteurs d'un voyage.
 * Résout les défauts D5 et D6 en dérivant les compteurs strictement
 * depuis les données réelles rendues, sans aucun chiffre en dur dans le JSX.
 */
export function getTripCounters(
  trip: TripFull,
  analysis?: TripKitAnalysis | null
): TripCounters {
  const stepsCount = Array.isArray(trip.steps) ? trip.steps.length : 0;
  const itemsCount = Array.isArray(trip.items) ? trip.items.length : 0;
  const expensesCount = Array.isArray(trip.expenses) ? trip.expenses.length : 0;
  const teamCount = (Array.isArray(trip.collaborators) ? trip.collaborators.length : 0) + 1; // +1 pour le créateur/owner
  const documentsCount = Array.isArray(trip.documents) ? trip.documents.length : 0;

  const vitalGaps = analysis?.vitalGaps?.length || 0;
  const recommendedGaps = analysis?.recommendedGaps?.length || 0;
  const gearGapsTotal = vitalGaps + recommendedGaps;

  return {
    itinerary: stepsCount,
    gearItems: itemsCount,
    gearGapsTotal,
    gearVitalGaps: vitalGaps,
    budget: expensesCount,
    team: teamCount,
    documents: documentsCount,
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
