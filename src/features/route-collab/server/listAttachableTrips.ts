import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { buildAttachChoices, type AttachTripChoice, type AttachTripRow } from '../attach';

/**
 * 1.1 : les voyages que la personne peut rattacher à un itinéraire, lus avec son propre client Supabase
 * (RLS) : ceux dont elle est propriétaire ou éditrice (`trip_collaborators`), les plus récents d'abord.
 * Erreur de lecture : liste vide, jamais d'exception (la page propose alors seulement « Nouveau voyage »).
 */
export async function listAttachableTrips(
  userId: string,
  tripsWithRoute: ReadonlySet<string> = new Set(),
): Promise<AttachTripChoice[]> {
  try {
    const supabase = await createClient();
    const { data: collabs, error: collabError } = await supabase
      .from('trip_collaborators')
      .select('trip_id, role')
      .eq('user_id', userId)
      .in('role', ['owner', 'editor']);
    if (collabError || !collabs || collabs.length === 0) return [];
    const roles = new Map<string, string>();
    for (const c of collabs as Array<{ trip_id: string; role: string }>) roles.set(c.trip_id, c.role);
    const { data: trips, error } = await supabase
      .from('trips')
      .select('id, title, destination_name, start_date, end_date')
      .in('id', [...roles.keys()].slice(0, 200))
      .order('created_at', { ascending: false })
      .limit(60);
    if (error || !trips) return [];
    return buildAttachChoices(trips as unknown as AttachTripRow[], roles, tripsWithRoute);
  } catch {
    return [];
  }
}
