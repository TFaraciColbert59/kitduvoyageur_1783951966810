import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { RouteRevisionSnapshot as ClubRouteRevisionSnapshot } from '@/features/clubs/types';
import { clubRouteFromPublished } from '../integrations';
import { hasRoutePermission } from '../permissions';
import { getRouteCollabStore } from '../store';

/**
 * Sortie de club → version publiée de l'itinéraire (10.5). Lecture sous RLS, droit `route.publish` exigé
 * (propriétaire, ou co-organisateur délégué) : proposer un tracé à un club est une publication. Le résultat
 * est l'instantané Clubs ; l'inscription à la sortie (RSVP) ne confère aucun droit d'édition du tracé.
 *
 * Écart connu : la RPC `publish_club_event_route` n'accepte aujourd'hui qu'un `route_id` du catalogue
 * (`hiking_routes`). Brancher l'instantané d'un espace d'itinéraire demande une RPC dédiée (migration, hors
 * périmètre) : voir `docs/itineraire-collaboratif/INTERCONNEXION-LKDV.md`.
 */
export type ClubEventRouteResult =
  | { status: 'ok'; snapshot: ClubRouteRevisionSnapshot }
  | { status: 'unauthenticated' | 'forbidden' | 'not_found' | 'no_published' | 'no_pack' | 'error' };

export async function getClubEventRouteFromPublished(
  workspaceId: string,
  eventId: string,
  supabase?: SupabaseClient,
): Promise<ClubEventRouteResult> {
  try {
    const client = supabase ?? ((await createClient()) as unknown as SupabaseClient);
    const { data } = await client.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return { status: 'unauthenticated' };
    const store = await getRouteCollabStore(client);
    const res = await store.getWorkspaceForActor(workspaceId, userId);
    if (!res.ok) return { status: 'not_found' };
    const member = res.workspace.members.find((m) => m.userId === userId);
    if (!hasRoutePermission(member, 'route.publish')) return { status: 'forbidden' };
    const built = clubRouteFromPublished(res.workspace, eventId);
    return built.status === 'ok' ? { status: 'ok', snapshot: built.snapshot } : { status: built.status };
  } catch {
    return { status: 'error' };
  }
}
