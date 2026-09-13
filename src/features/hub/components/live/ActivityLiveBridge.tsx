'use client';

// Hub live (§4.5) — pont realtime dédié (canal `hub-live-bridge`).
// HubRealtimeRefresh (WIP propriétaire) n'est pas modifié : ce composant
// écoute les mêmes tables via son propre canal et relaie chaque ligne
// INSERT/UPDATE sur le bus window consommé par useActivityLiveArrivals.
// Il ne déclenche aucun router.refresh() : zéro doublon de rafraîchissement.
// Fix round final — le pont calcule le bassin de la ligne (`payload.new`) :
// une étape portant hébergement/transport alimente `affiliation`, sans quoi le
// rail ne pouvait jamais se compléter (le job LLM n'écrit aucune dépense).
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { bucketForRow, type ActivityArrivalBucket } from './preparationPhases';
import {
  ACTIVITY_ARRIVAL_EVENT,
  type ActivityArrivalEventType,
} from './useActivityLiveArrivals';

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

/**
 * Émet une arrivée sur le bus window (no-op côté serveur). `bucket` est
 * optionnel : omis, le détail garde la forme historique `{ table, id, eventType }`.
 */
export function emitActivityArrival(
  table: string,
  id: string,
  eventType: ActivityArrivalEventType,
  bucket?: ActivityArrivalBucket | null
): void {
  if (typeof window === 'undefined') return;
  const detail = bucket ? { table, id, eventType, bucket } : { table, id, eventType };
  window.dispatchEvent(new CustomEvent(ACTIVITY_ARRIVAL_EVENT, { detail }));
}

interface RealtimeRowPayload {
  table?: string;
  eventType?: string;
  new?: unknown;
}

export function ActivityLiveBridge({ tripId }: ActivityLiveBridgeProps) {
  useEffect(() => {
    // Tant qu'aucun trip actif n'existe, aucun abonnement : jamais de canal
    // non scopé sur les 5 tables trip_* (les filtres restent par voyage).
    if (!tripId) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const forward = (payload: RealtimeRowPayload) => {
      if (cancelled || !payload.table) return;
      const row =
        payload.new && typeof payload.new === 'object'
          ? (payload.new as {
              id?: unknown;
              accommodation_name?: unknown;
              transport_mode?: unknown;
            })
          : undefined;
      const id = row?.id;
      if (id === null || id === undefined) return;
      const eventType: ActivityArrivalEventType =
        payload.eventType === 'UPDATE' ? 'UPDATE' : 'INSERT';
      emitActivityArrival(payload.table, String(id), eventType, bucketForRow(payload.table, row));
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
