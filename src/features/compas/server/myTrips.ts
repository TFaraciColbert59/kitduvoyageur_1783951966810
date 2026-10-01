import 'server-only';

import { createClient } from '@/lib/supabase/server';

/** Une aventure que la personne peut ouvrir dans le Compas. */
export interface CompasTripChoice {
  id: string;
  slug: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  role: 'owner' | 'collaborator';
}

type TripRow = {
  id: string;
  slug: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
};

/**
 * Les voyages de la personne (créés ou partagés avec elle), du plus récent au
 * plus ancien. Sert quand aucune aventure n'est active : le Compas propose de
 * choisir au lieu d'ouvrir d'office la création. Jamais les voyages publics
 * d'autres personnes, même si la RLS les laisse lire.
 */
export async function listCompasTrips(): Promise<CompasTripChoice[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: owned }, { data: shared }] = await Promise.all([
    supabase
      .from('trips')
      .select('id, slug, title, start_date, end_date')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from('trip_collaborators')
      .select('trips(id, slug, title, start_date, end_date)')
      .eq('user_id', user.id)
      .neq('role', 'owner')
      .limit(20),
  ]);

  const out: CompasTripChoice[] = [];
  const seen = new Set<string>();
  const push = (row: TripRow | null | undefined, role: CompasTripChoice['role']) => {
    if (!row?.slug || seen.has(row.id)) return;
    seen.add(row.id);
    out.push({
      id: row.id,
      slug: row.slug,
      title: row.title?.trim() || 'Voyage sans titre',
      startDate: row.start_date,
      endDate: row.end_date,
      role,
    });
  };
  for (const row of (owned ?? []) as TripRow[]) push(row, 'owner');
  for (const link of (shared ?? []) as Array<{ trips: TripRow | TripRow[] | null }>) {
    const row = Array.isArray(link.trips) ? link.trips[0] : link.trips;
    push(row, 'collaborator');
  }
  return out;
}
