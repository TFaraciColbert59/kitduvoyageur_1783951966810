import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { hasRoutePermission } from '../permissions';
import { getRouteCollabStore } from '../store';
import {
  DEFAULT_COMMUNITY_TARGETS,
  buildPublicRouteShare,
  toCarnetPayload,
  toCommunityPostPayload,
  toStoryRow,
  type CommunityPostOptions,
  type CommunityTargets,
} from '../communityShare';

/**
 * Publie la version publiée d'un itinéraire dans la communauté (10.9) : post, story (texte, 24 h) et/ou carnet,
 * par les flux de création existants : RPC atomiques `create_community_post` et `create_carnet_v2` (audience,
 * club, carnet lié et idempotence `client_request_id` contrôlés en SQL, avec l'identité de la personne) et la
 * table `post_stories` sous sa RLS. Droit exigé : `route.manage_privacy` (propriétaire), car publier un tracé le
 * rend visible hors du voyage. Les trois cibles partent de la même `buildPublicRouteShare` : version publiée
 * seulement, zone de départ masquée (voir `communityShare.ts`). Audience club : seulement si la personne est
 * membre actif du club (vérifié ici, puis en SQL / RLS).
 */
export type TargetStatus = 'ok' | 'rejected' | 'error';
export interface TargetResult {
  readonly status: TargetStatus;
  readonly id?: string;
  readonly idempotent?: boolean;
}
export interface PublishResults {
  readonly post?: TargetResult;
  readonly story?: TargetResult;
  readonly carnet?: TargetResult;
}

export type ShareToCommunityResult =
  | { status: 'ok'; postId?: string; idempotent: boolean; results: PublishResults }
  | { status: 'partial'; results: PublishResults }
  | { status: 'unauthenticated' | 'forbidden' | 'not_found' | 'no_published' | 'rejected' | 'error' | 'not_club_member'; results?: PublishResults };

const REJECTED_CODES = new Set(['P0001', '22023', '23514', '42501', '23503']);
const failure = (error: { code?: string } | null | undefined): TargetResult => ({
  status: error?.code && REJECTED_CODES.has(error.code) ? 'rejected' : 'error',
});

export async function listMyActiveClubs(client: SupabaseClient, userId: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const { data, error } = await client
      .from('club_members')
      .select('club_id, clubs(id, name)')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error || !Array.isArray(data)) return [];
    const out: Array<{ id: string; name: string }> = [];
    for (const row of data as unknown as Array<{ clubs?: { id?: string; name?: string } | Array<{ id?: string; name?: string }> | null }>) {
      const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
      if (club?.id && typeof club.name === 'string') out.push({ id: club.id, name: club.name });
    }
    return out;
  } catch {
    return [];
  }
}

export async function publishRouteToCommunity(
  workspaceId: string,
  options: CommunityPostOptions,
  targets: CommunityTargets = DEFAULT_COMMUNITY_TARGETS,
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
    if (options.audience === 'club') {
      const clubs = await listMyActiveClubs(client, userId);
      if (!options.clubId || !clubs.some((c) => c.id === options.clubId)) return { status: 'not_club_member' };
    }

    const results: { post?: TargetResult; story?: TargetResult; carnet?: TargetResult } = {};

    // 1. Carnet d'abord : le post et la story s'y rattachent.
    let carnetId: string | null = options.linkedCarnetId ?? null;
    if (targets.carnet) {
      const { data, error } = await client.rpc('create_carnet_v2', { p: toCarnetPayload(share, options) });
      const row = data as { id?: string; idempotent?: boolean } | null;
      if (error || !row?.id) results.carnet = failure(error);
      else {
        carnetId = row.id;
        results.carnet = { status: 'ok', id: row.id, idempotent: row.idempotent === true };
      }
    }

    // 2. Post, par la RPC du tiroir Création.
    if (targets.post) {
      const { data, error } = await client.rpc('create_community_post', {
        p: toCommunityPostPayload(share, { ...options, linkedCarnetId: carnetId }),
      });
      const row = data as { id?: string; idempotent?: boolean } | null;
      results.post = error || !row?.id ? failure(error) : { status: 'ok', id: row.id, idempotent: row.idempotent === true };
    }

    // 3. Story texte : même table et mêmes colonnes que le flux de création de story, sous la RLS de la personne.
    if (targets.story) {
      const storyId = crypto.randomUUID();
      const { error } = await client.from('post_stories').insert(toStoryRow(share, options, userId, storyId, carnetId));
      if (!error) results.story = { status: 'ok', id: storyId, idempotent: false };
      else if (error.code === '23505') results.story = { status: 'ok', idempotent: true };
      else results.story = failure(error);
    }

    const all = Object.values(results);
    const okCount = all.filter((r) => r.status === 'ok').length;
    if (okCount === all.length) {
      return { status: 'ok', postId: results.post?.id, idempotent: all.every((r) => r.idempotent === true), results };
    }
    if (okCount > 0) return { status: 'partial', results };
    const first = all[0]?.status === 'rejected' ? 'rejected' : 'error';
    return { status: first, results };
  } catch {
    return { status: 'error' };
  }
}

/** Clubs de la personne (membre actif, sous RLS), pour proposer l'audience « Mon club ». */
export async function myClubsForShare(): Promise<Array<{ id: string; name: string }>> {
  try {
    const client = (await createClient()) as unknown as SupabaseClient;
    const { data: auth } = await client.auth.getUser();
    if (!auth.user?.id) return [];
    return await listMyActiveClubs(client, auth.user.id);
  } catch {
    return [];
  }
}
