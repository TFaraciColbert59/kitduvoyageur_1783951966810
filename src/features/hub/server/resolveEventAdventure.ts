import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { EventAdventureRef } from '../context/eventAdventureRef';

type LinkedAdventure = {
  id: string;
  slug: string;
  title: string;
  organizer_id: string;
  route_revision: number | null;
};

/** L'accès à la projection dépend de l'organisateur et de l'inscription courante. */
export async function resolveEventAdventure(ref: EventAdventureRef) {
  const client = await createClient();
  const { data, error } = await client
    .rpc('resolve_event_trip', { p_source_kind: ref.kind, p_event_id: ref.id })
    .maybeSingle<LinkedAdventure>();

  if (error) {
    if (error.code !== 'PGRST202') console.error('[LKDV] resolveEventAdventure', error.code);
    return null;
  }
  return data;
}
