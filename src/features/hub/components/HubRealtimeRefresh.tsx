'use client';

// Hub V4 — Hub temps réel (version minimale) : abonnement Supabase Realtime
// aux tables vivantes de la nature active → router.refresh() débouncé.
// Les compteurs du hub se mettent à jour en direct pour tout l'équipage.
// Dégrade silencieusement si le Realtime est indisponible.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface HubRealtimeRefreshProps {
  nature: 'sortie' | 'possession' | 'collectif';
  /** id du voyage actif (sortie) — filtre les événements. */
  tripId?: string | null;
  /** id du groupe actif (collectif) — filtre les événements. */
  groupId?: string | null;
}

const REFRESH_DEBOUNCE_MS = 1200;

/** Tables vivantes par nature (noms réels du schéma public). */
const TABLES: Record<HubRealtimeRefreshProps['nature'], string[]> = {
  sortie: ['trip_expenses', 'trip_safety_checkpoints', 'trip_notes', 'trip_collaborators', 'trip_items'],
  possession: ['materiel_kits', 'materiel_kit_items', 'materiel_loans', 'alerts'],
  collectif: ['group_tasks', 'group_polls', 'group_messages', 'group_members', 'group_expenses'],
};

export function HubRealtimeRefresh({ nature, tripId, groupId }: HubRealtimeRefreshProps) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!cancelled) router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    let cleanup: (() => void) | null = null;
    try {
      const supabase = createClient();
      const channel = supabase.channel('hub-realtime-refresh');
      for (const table of TABLES[nature]) {
        const filter =
          table.startsWith('trip_') && tripId
            ? `trip_id=eq.${tripId}`
            : table.startsWith('group_') && groupId
              ? `group_id=eq.${groupId}`
              : undefined;
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, scheduleRefresh);
      }
      channel.subscribe();
      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Realtime indisponible : le hub reste fonctionnel via refresh normal.
    }

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      cleanup?.();
    };
  }, [nature, tripId, groupId, router]);

  return null;
}

export default HubRealtimeRefresh;
