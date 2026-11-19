'use client';

import { useCallback, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface MySortieOptionV2 {
  id: string;
  title: string;
  eventDate: string;
  location: string;
  meetingPoint: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  maxParticipants: number | null;
  currentParticipants: number;
  activity: string | null;
  emoji: string | null;
}

/**
 * Sorties organisées par l'utilisateur — utilisées par le format « Événement »
 * des Publications pour rattacher une sortie existante à une date donnée ou
 * proposer sa création en amont si aucune sortie n'existe encore.
 */
export function useMySortiesV2(userId: string | null | undefined) {
  const [sorties, setSorties] = useState<MySortieOptionV2[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const fetchSorties = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from('events')
        .select(
          'id, title, event_date, location, meeting_point, distance_km, elevation_gain_m, max_participants, current_participants, activity, emoji, status',
        )
        .eq('organizer_id', userId)
        .neq('status', 'cancelled')
        .order('event_date', { ascending: true })
        .limit(40);
      if (queryError) throw queryError;
      const rows = Array.isArray(data) ? data : [];
      setSorties(
        rows
          .filter((row) => typeof row.id === 'string' && typeof row.event_date === 'string')
          .map((row) => ({
            id: row.id as string,
            title: String(row.title ?? 'Sortie'),
            eventDate: String(row.event_date ?? '').slice(0, 10),
            location: String(row.location ?? ''),
            meetingPoint: typeof row.meeting_point === 'string' ? row.meeting_point : null,
            distanceKm: typeof row.distance_km === 'number' ? row.distance_km : null,
            elevationGainM: typeof row.elevation_gain_m === 'number' ? row.elevation_gain_m : null,
            maxParticipants: typeof row.max_participants === 'number' ? row.max_participants : null,
            currentParticipants: typeof row.current_participants === 'number' ? row.current_participants : 0,
            activity: typeof row.activity === 'string' ? row.activity : null,
            emoji: typeof row.emoji === 'string' ? row.emoji : null,
          })),
      );
    } catch {
      setSorties([]);
      setError('Impossible de charger tes sorties.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId || requested.current) return;
    requested.current = true;
    await fetchSorties();
  }, [fetchSorties, userId]);

  const reload = useCallback(async () => {
    requested.current = true;
    await fetchSorties();
  }, [fetchSorties]);

  return { sorties, loading, error, load, reload };
}
