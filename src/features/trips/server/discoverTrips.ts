import 'server-only';

import { cache } from 'react';
import { normalizeCivilDateString } from '@/features/trips/engine/temporalPhaseEngine';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 20;
const CHOICE_COLUMNS = 'id, user_id, slug, title, status, primary_activity, start_date, end_date, cover_image_url';
const ACTIVE_STATUSES = ['draft', 'planned', 'active'];

type StepMetrics = { distance_km: number | null; elevation_gain_m: number | null };
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
  trip_steps: StepMetrics[];
};

type DirectTripChoice = TripChoiceRow & { membership: { role: string }[]; attendance: { role: string }[] };
type ParticipantTripChoice = Omit<TripChoiceRow, 'trip_steps'> & { steps: StepMetrics[] };

async function readPages<Row>(page: (start: number) => PromiseLike<{
  data: unknown[] | null;
  error: { code: string } | null;
}>) {
  const rows: Row[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await page(start);
    if (error) return { rows, error };
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}

/** Source partagée par Compas et HUB. La session de l'appelant contrôle les deux lectures. */
export const discoverTrips = cache(async (userId: string) => {
  const client = await createClient();
  const today = normalizeCivilDateString();
  const withinDates = 'status.eq.active,end_date.gte.' + today + ',and(end_date.is.null,or(start_date.is.null,start_date.gte.' + today + '))';

  const [direct, confirmed] = await Promise.all([
    readPages<DirectTripChoice>((start) => client
      .from('trips')
      .select(CHOICE_COLUMNS + ', trip_steps(distance_km, elevation_gain_m), membership:trip_collaborators(role), attendance:trip_participants(role)')
      .eq('membership.user_id', userId)
      .eq('attendance.user_id', userId)
      .eq('attendance.status', 'confirmed')
      .or('user_id.eq.' + userId + ',membership.not.is.null,attendance.not.is.null')
      .in('status', ACTIVE_STATUSES)
      .or(withinDates)
      .not('slug', 'is', null)
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('id')
      .range(start, start + PAGE_SIZE - 1)),
    readPages<ParticipantTripChoice>((start) => client
      .rpc('get_confirmed_trip_overview')
      .select(CHOICE_COLUMNS + ', steps')
      .in('status', ACTIVE_STATUSES)
      .or(withinDates)
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('id')
      .range(start, start + PAGE_SIZE - 1)
      .overrideTypes<ParticipantTripChoice[], { merge: false }>()),
  ]);

  const trips = new Map<string, TripChoiceRow & { affiliation: 'owner' | 'collaborator' | 'participant' }>();
  for (const { steps, ...row } of confirmed.rows) {
    trips.set(row.id, { ...row, trip_steps: steps, affiliation: 'participant' });
  }
  for (const { membership, attendance, ...row } of direct.rows) {
    const affiliation = row.user_id === userId ? 'owner' : membership.length ? 'collaborator' : 'participant';
    if (affiliation === 'participant' && !attendance.length) continue;
    trips.set(row.id, { ...row, affiliation });
  }
  // Déploiement progressif sur les environnements où la fonction n'est pas encore publiée.
  const participantError = confirmed.error?.code === 'PGRST202' ? null : confirmed.error;
  if (direct.error || participantError) {
    console.error('[LKDV] discoverTrips', direct.error?.code ?? participantError?.code);
  }
  return {
    trips: [...trips.values()].sort((a, b) =>
      (b.start_date ?? '').localeCompare(a.start_date ?? '') || a.id.localeCompare(b.id)),
    unavailable: Boolean(direct.error || participantError),
  };
});
