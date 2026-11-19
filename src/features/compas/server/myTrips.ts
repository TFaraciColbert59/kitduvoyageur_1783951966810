import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { discoverTrips } from '@/features/trips/server/discoverTrips';

/** Une aventure que la personne peut ouvrir dans le Compas. */
export interface CompasTripChoice {
  id: string;
  slug: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  role: 'owner' | 'collaborator';
}

export async function listCompasTrips(): Promise<CompasTripChoice[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { trips } = await discoverTrips(user.id);
  return trips.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title?.trim() || 'Voyage sans titre',
    startDate: row.start_date,
    endDate: row.end_date,
    role: row.user_id === user.id ? 'owner' : 'collaborator',
  }));
}
