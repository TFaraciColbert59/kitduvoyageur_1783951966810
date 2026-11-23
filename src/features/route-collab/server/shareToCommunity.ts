import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { hasRoutePermission } from '../permissions';
import { getRouteCollabStore } from '../store';
import { buildPublicRouteShare, toCommunityPostPayload, type CommunityPostOptions } from '../communityShare';

/**
 * Publie la version publiée d'un itinéraire en post de la communauté (10.9), par la RPC atomique
 * `create_community_post` (celle du tiroir Création : audience, club, carnet lié et idempotence
 * `client_request_id` y sont déjà contrôlés, en SQL, avec l'identité de la personne). Droit exigé :
 * `route.manage_privacy` (propriétaire), car publier un tracé le rend visible hors du voyage. La zone de
 * départ est masquée (voir `communityShare.ts`).
 */
export type ShareToCommunityResult =
  | { status: 'ok'; postId: string; idempotent: boolean }
  | { status: 'unauthenticated' | 'forbidden' | 'not_found' | 'no_published' | 'rejected' | 'error' };

export async function publishRouteToCommunity(
  workspaceId: string,
  options: CommunityPostOptions,
): Promise<ShareToCommunityResult> {
  try {
    const client = (await createClient()) as unknown as SupabaseClient;
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { status: 'unauthenticated' };
    const store = await getRouteCollabStore(client);
    const res = await store.getWorkspaceForActor(workspaceId, userId);
    if (!res.ok) return { status: 'not_found' };
    const member = res.workspace.members.find((m) => m.userId === userId);
    if (!hasRoutePermission(member, 'route.manage_privacy')) return { status: 'forbidden' };
    const share = buildPublicRouteShare(res.workspace);
    if (!share) return { status: 'no_published' };
    const { data, error } = await client.rpc('create_community_post', { p: toCommunityPostPayload(share, options) });
    if (error) return { status: error.code === 'P0001' || error.code === '22023' || error.code === '23514' ? 'rejected' : 'error' };
    const row = data as { id?: string; idempotent?: boolean } | null;
    if (!row?.id) return { status: 'error' };
    return { status: 'ok', postId: row.id, idempotent: row.idempotent === true };
  } catch {
    return { status: 'error' };
  }
}
