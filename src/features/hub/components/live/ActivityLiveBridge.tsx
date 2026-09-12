'use client';

// Hub live (§4.5) — pont realtime dédié (canal `hub-live-bridge`).
// HubRealtimeRefresh (WIP propriétaire) n'est pas modifié : ce composant
// écoute les mêmes tables via son propre canal et relaie chaque ligne
// INSERT/UPDATE sur le bus window consommé par useActivityLiveArrivals.
// Il ne déclenche aucun router.refresh() : zéro doublon de rafraîchissement.
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ACTIVITY_ARRIVAL_EVENT } from './useActivityLiveArrivals';

export interface ActivityLiveBridgeProps {
  /** id du voyage actif — filtre les événements de ses tables. */
  tripId?: string | null;
}

/** Tables vivantes de la préparation d'activité. */
export const ACTIVITY_LIVE_TABLES = [
  'trip_steps',
  'trip_pois',
  'trip_expenses',
  'trip_items',
  'trip_checklist_items',
] as const;

/** Émet une arrivée sur le bus window (no-op côté serveur). */
export function emitActivityArrival(table: string, id: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ACTIVITY_ARRIVAL_EVENT, { detail: { table, id } }));
}

export function ActivityLiveBridge({ tripId }: ActivityLiveBridgeProps) {
  useEffect(() => {
    // Tant qu'aucun trip actif n'existe, aucun abonnement : jamais de canal
    // non scopé sur les 5 tables trip_* (les filtres restent par voyage).
    if (!tripId) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const forward = (payload: { table?: string; new?: { id?: unknown } }) => {
      if (cancelled || !payload.table) return;
      const id = payload.new?.id;
      if (id === null || id === undefined) return;
      emitActivityArrival(payload.table, String(id));
    };

    try {
      const supabase = createClient();
      const channel = supabase.channel('hub-live-bridge');
      const filter = `trip_id=eq.${tripId}`;
      for (const table of ACTIVITY_LIVE_TABLES) {
        channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table, filter },
          forward
        );
        channel.on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table, filter },
          forward
        );
      }
      channel.subscribe();
      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Realtime indisponible : le hub reste fonctionnel, sans animation.
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [tripId]);

  return null;
}

export default ActivityLiveBridge;
