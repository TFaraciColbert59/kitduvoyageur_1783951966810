import { useMemo } from 'react';
import type { TripStatus } from '../types/trip.types';

/**
 * Sélecteur unique de l'état (statut) d'un voyage (Règle Z-R3).
 *
 * Résout le défaut Z-D25 : la pastille verte « Active » et le badge
 * « Brouillon » pouvaient s'afficher simultanément. Le statut 'draft' et
 * l'état 'active' sont MUTUELLEMENT EXCLUSIFS : isActive est strictement dérivé
 * de trip.status === 'active'.
 */

export interface TripStatusView {
  status: TripStatus;
  /** Vrai uniquement si le voyage est réellement au statut 'active'. */
  isActive: boolean;
}

export function getTripStatus(trip: {
  status?: TripStatus | string | null;
}): TripStatusView {
  const status = (trip.status as TripStatus) || 'draft';
  return { status, isActive: status === 'active' };
}

export function useTripStatus(trip: {
  status?: TripStatus | string | null;
}): TripStatusView {
  const status = (trip.status as TripStatus) || 'draft';
  return useMemo(
    () => ({ status, isActive: status === 'active' }),
    [status]
  );
}
