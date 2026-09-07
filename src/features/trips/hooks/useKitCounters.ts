import { useMemo } from 'react';
import type { TripItem } from '../types/trip.types';

/**
 * Sélecteur unique des compteurs de kit (Règle Z-R3).
 *
 * Résout le défaut Z-D21 : « 0/3 objets prêts » dans un endroit, « 0/11 » dans
 * un autre. L'Aperçu (TripOverviewTab) s'appuyait sur des statistiques serveur
 * (TripStats.items_packed / items_total) alors que la Vue Kit (TripKitView)
 * s'appuyait sur la liste trip.items. Tous deux dérivent désormais de LA même
 * liste trip.items.
 */

export interface KitCounters {
  /** Nombre d'objets cochés comme emballés. */
  ready: number;
  /** Nombre total d'objets. */
  total: number;
}

export function getKitCounters(
  items: TripItem[] | undefined | null
): KitCounters {
  const list = Array.isArray(items) ? items : [];
  const ready = list.filter((i) => Boolean(i.is_packed)).length;
  return { ready, total: list.length };
}

export function useKitCounters(trip: {
  items?: TripItem[] | null;
}): KitCounters {
  return useMemo(() => getKitCounters(trip?.items), [trip]);
}
