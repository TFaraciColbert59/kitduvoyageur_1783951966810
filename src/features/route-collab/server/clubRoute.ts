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
 * Publication réelle : la RPC `publish_club_event_route_from_workspace` (migration 20261123130000) copie la version
 * PUBLIÉE de l'espace dans les révisions de tracé de la sortie. Elle exige, en base, que l'appelant organise la sortie
 * (ou modère le club) ET possède l'espace (propriétaire, ou co-organisateur à publication déléguée). La RPC
 * `publish_club_event_route` du catalogue (`route_id` de `hiking_routes`) reste inchangée.
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

export interface OrganizerClubEvent {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string | null;
  readonly visibility: string | null;
}

/** Sorties de club à venir dont la personne est l'organisatrice (RLS). Vide : le bouton n'est pas proposé. */
export async function listOrganizerClubEvents(
  supabase?: SupabaseClient,
): Promise<{ status: 'ok'; events: OrganizerClubEvent[] } | { status: 'unauthenticated' | 'error' }> {
  try {
    const client = supabase ?? ((await createClient()) as unknown as SupabaseClient);
    const { data } = await client.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return { status: 'unauthenticated' };
    const { data: rows, error } = await client
      .from('club_events')
      .select('id, title, starts_at, visibility')
      .eq('organizer_id', userId)
      .is('cancelled_at', null)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(50);
    if (error) return { status: 'error' };
    const floor = Date.now() - 24 * 3600_000;
    const events = ((rows ?? []) as Array<{ id: string; title: string | null; starts_at: string | null; visibility: string | null }>)
      .filter((r) => !r.starts_at || Date.parse(r.starts_at) >= floor)
      .slice(0, 20)
      .map((r) => ({ id: r.id, title: (r.title ?? 'Sortie du club').slice(0, 120), startsAt: r.starts_at, visibility: r.visibility }));
    return { status: 'ok', events };
  } catch {
    return { status: 'error' };
  }
}

export type PublishToClubResult =
  | { status: 'ok'; revision: number; unchanged: boolean }
  | { status: 'unauthenticated' | 'forbidden' | 'no_published' | 'no_pack' | 'unavailable' | 'invalid' | 'error' };

/** Appelle la RPC de publication ; les refus de la base deviennent des statuts, sans détail interne. */
export async function publishWorkspaceToClubEvent(
  workspaceId: string,
  eventId: string,
  supabase?: SupabaseClient,
): Promise<PublishToClubResult> {
  try {
    const client = supabase ?? ((await createClient()) as unknown as SupabaseClient);
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return { status: 'unauthenticated' };
    const before = await client.from('club_events').select('route_revision').eq('id', eventId).maybeSingle();
    const { data, error } = await client.rpc('publish_club_event_route_from_workspace', { p_event_id: eventId, p_workspace_id: workspaceId });
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === '42501') return { status: 'forbidden' };
      if (code === 'P0002') return { status: /pack/i.test(error.message ?? '') ? 'no_pack' : 'no_published' };
      if (code === '55000') return { status: 'unavailable' };
      if (code === '22023') return { status: 'invalid' };
      return { status: 'error' };
    }
    const revision = Number((data as { snapshot?: { revision?: unknown } } | null)?.snapshot?.revision);
    if (!Number.isInteger(revision) || revision < 1) return { status: 'error' };
    const previous = Number((before.data as { route_revision?: unknown } | null)?.route_revision);
    return { status: 'ok', revision, unchanged: previous === revision };
  } catch {
    return { status: 'error' };
  }
}
