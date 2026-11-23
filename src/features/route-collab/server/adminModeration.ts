import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  ROUTE_MODERATION_TYPES,
  toAuditRow,
  toItems,
  toQueueRow,
  withQueueStatus,
  type ModerationDecision,
  type ModerationStatus,
  type RouteModerationItem,
  type RouteModerationType,
} from '../moderationModel';

/**
 * Audit de modération des itinéraires (10.10), côté serveur, réservé aux modérateurs (`is_moderateur()`,
 * même mécanisme que `/api/admin/*`). Écritures sous RLS : `moderation_queue` (« modos_manage_moderation_queue »)
 * et `admin_audit_log` (« admins_insert_audit_log » : is_moderateur()). Sources :
 *  - traces publiques : `community_posts` créés par « Publier le tracé » (`creation_meta.created_from = route_collab`) ;
 *  - commentaires et liens partagés : RPC `admin_list_route_moderation` PROPOSÉE (SQL dans
 *    `docs/itineraire-collaboratif/MIGRATION-PROPOSEE-ADMIN.sql`, non appliquée) : tant qu'elle est absente,
 *    ces deux sources sont déclarées « indisponibles », jamais affichées vides comme si tout allait bien.
 * Une décision est CONSIGNÉE (file + journal) ; sa mise en œuvre (masquer, supprimer, révoquer) reste une
 * action distincte, pas encore branchée (`enforced: false`).
 */
export type ModerationListResult =
  | {
      status: 'ok';
      items: RouteModerationItem[];
      unavailable: Array<'route_comment' | 'route_share_link'>;
    }
  | { status: 'unauthenticated' | 'forbidden' | 'error' };

async function moderatorId(client: SupabaseClient): Promise<{ id: string } | 'unauthenticated' | 'forbidden'> {
  const { data } = await client.auth.getUser();
  if (!data.user) return 'unauthenticated';
  const { data: ok, error } = await client.rpc('is_moderateur');
  if (error || ok !== true) return 'forbidden';
  return { id: data.user.id };
}

export async function listRouteModeration(): Promise<ModerationListResult> {
  try {
    const client = (await createClient()) as unknown as SupabaseClient;
    const who = await moderatorId(client);
    if (typeof who === 'string') return { status: who };

    const unavailable: Array<'route_comment' | 'route_share_link'> = [];
    const items: RouteModerationItem[] = [];

    const { data: posts, error: postsError } = await client
      .from('community_posts')
      .select('id, content, created_at')
      .eq('creation_meta->>created_from', 'route_collab')
      .order('created_at', { ascending: false })
      .limit(50);
    if (postsError) return { status: 'error' };
    items.push(
      ...toItems(
        'route_public_trace',
        ((posts ?? []) as Array<{ id: string; content: string | null; created_at: string }>).map((p) => ({
          id: p.id,
          preview: p.content,
          created_at: p.created_at,
        })),
      ),
    );

    const { data: extra, error: rpcError } = await client.rpc('admin_list_route_moderation', { p_limit: 50 });
    if (rpcError || !Array.isArray(extra)) {
      unavailable.push('route_comment', 'route_share_link');
    } else {
      for (const type of ['route_comment', 'route_share_link'] as const) {
        items.push(
          ...toItems(
            type,
            (extra as Array<{ type?: string; id?: string; preview?: string; created_at?: string }>).filter((r) => r.type === type),
          ),
        );
      }
    }

    const { data: queue } = await client
      .from('moderation_queue')
      .select('contenu_type, contenu_id, statut')
      .in('contenu_type', [...ROUTE_MODERATION_TYPES])
      .order('updated_at', { ascending: true })
      .limit(500);
    return { status: 'ok', items: withQueueStatus(items, (queue ?? []) as Array<Record<string, unknown>>), unavailable };
  } catch {
    return { status: 'error' };
  }
}

export type ModerationDecisionResult =
  | { status: 'ok'; enforced: false; statut: ModerationStatus }
  | { status: 'unauthenticated' | 'forbidden' | 'error' };

export async function decideRouteModeration(input: {
  type: RouteModerationType;
  id: string;
  decision: ModerationDecision;
}): Promise<ModerationDecisionResult> {
  try {
    const client = (await createClient()) as unknown as SupabaseClient;
    const who = await moderatorId(client);
    if (typeof who === 'string') return { status: who };

    const { data: existing } = await client
      .from('moderation_queue')
      .select('id, statut')
      .eq('contenu_type', input.type)
      .eq('contenu_id', input.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const before = ((existing as { statut?: ModerationStatus } | null)?.statut ?? null) as ModerationStatus | null;
    const row = toQueueRow({ ...input, moderatorId: who.id });
    const write = existing
      ? await client.from('moderation_queue').update({ statut: row.statut, moderateur_id: row.moderateur_id }).eq('id', (existing as { id: string }).id)
      : await client.from('moderation_queue').insert(row);
    if (write.error) return { status: 'error' };
    const audit = await client.from('admin_audit_log').insert(toAuditRow({ ...input, moderatorId: who.id, before }));
    if (audit.error) return { status: 'error' };
    return { status: 'ok', enforced: false, statut: row.statut };
  } catch {
    return { status: 'error' };
  }
}

export type AuditListResult =
  | { status: 'ok'; entries: Array<{ id: string; action: string; target: string; targetId: string; at: string }> }
  | { status: 'unauthenticated' | 'forbidden' | 'error' };

/** Journal d'audit (lecture admin : RLS « admins_read_audit_log »). Identifiants seulement, pas de contenu. */
export async function listAuditLog(limit = 50): Promise<AuditListResult> {
  try {
    const client = (await createClient()) as unknown as SupabaseClient;
    const who = await moderatorId(client);
    if (typeof who === 'string') return { status: who };
    const { data, error } = await client
      .from('admin_audit_log')
      .select('id, action, cible_type, cible_id, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(200, limit)));
    if (error) return { status: 'error' };
    return {
      status: 'ok',
      entries: ((data ?? []) as Array<{ id: string; action: string; cible_type: string; cible_id: string; created_at: string }>).map((r) => ({
        id: r.id,
        action: r.action,
        target: r.cible_type,
        targetId: r.cible_id,
        at: r.created_at,
      })),
    };
  } catch {
    return { status: 'error' };
  }
}
