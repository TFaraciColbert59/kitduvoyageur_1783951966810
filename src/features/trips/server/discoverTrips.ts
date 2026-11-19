import 'server-only';

import { cache } from 'react';
import { normalizeCivilDateString } from '@/features/trips/engine/temporalPhaseEngine';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 20;

type TripChoiceRow = {
  id: string;
  user_id: string;
  slug: string;
  title: string | null;
  status: string;
  primary_activity: string;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  trip_steps: { distance_km: number | null; elevation_gain_m: number | null }[];
};

/**
 * Hub et Compas utilisent la même liste, dans l'ordre de la date puis de l'ID.
 * Le client de la session applique la RLS. Les relations portent sur cet
 * utilisateur pour exclure du sélecteur les voyages publics sans affiliation.
 */
export const discoverTrips = cache(async (userId: string) => {
  const client = await createClient();
  const today = normalizeCivilDateString();
  const trips = new Map<string, TripChoiceRow>();
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await client
      .from('trips')
      .select('id, user_id, slug, title, status, primary_activity, start_date, end_date, cover_image_url, trip_steps(distance_km, elevation_gain_m), membership:trip_collaborators(), attendance:trip_participants()')
      .eq('membership.user_id', userId)
      .eq('attendance.user_id', userId)
      .eq('attendance.status', 'confirmed')
      .or('user_id.eq.' + userId + ',membership.not.is.null,attendance.not.is.null')
      .in('status', ['draft', 'planned', 'active'])
      .or('status.eq.active,end_date.gte.' + today + ',and(end_date.is.null,or(start_date.is.null,start_date.gte.' + today + '))')
      .not('slug', 'is', null)
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('id')
      .range(start, start + PAGE_SIZE - 1);

    if (error) {
      console.error('[LKDV] discoverTrips', error.code);
      return { trips: [...trips.values()], unavailable: true };
    }
    const rows = (data ?? []) as TripChoiceRow[];
    for (const row of rows) trips.set(row.id, row);
    if (rows.length < PAGE_SIZE) break;
  }

  return { trips: [...trips.values()], unavailable: false };
});
