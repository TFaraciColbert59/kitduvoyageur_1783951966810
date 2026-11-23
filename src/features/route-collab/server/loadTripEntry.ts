import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { buildTripEntry, type TripEntryResult, type TripRow } from '../entry';

const COLUMNS =
  'id, title, start_date, end_date, destination_name, destination_country_code, party_size, metadata, primary_activity';

/**
 * Lit le voyage d'entrée de /compas/itineraire (1.1, 1.2, 1.6) avec le client Supabase de la personne :
 * la RLS décide (propriétaire, collaborateur). Un voyage privé et un voyage absent se confondent
 * (`not_found`), pour ne rien révéler. Seule la sérialisation sans donnée privée sort d'ici (`TripEntry`).
 */
export async function loadTripEntry(tripId: string): Promise<TripEntryResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('trips').select(COLUMNS).eq('id', tripId).maybeSingle();
    if (error) return { status: 'error' };
    if (!data) return { status: 'not_found' };
    return { status: 'ok', entry: buildTripEntry(data as unknown as TripRow) };
  } catch {
    return { status: 'error' };
  }
}
