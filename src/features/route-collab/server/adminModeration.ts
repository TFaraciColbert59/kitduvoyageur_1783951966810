import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  ROUTE_MODERATION_TYPES,
  defaultEnforcement,
  isEnforcementAllowed,
  toAuditRow,
  statusOfDecision,
  toItems,
  withAuditStatus,
  type ModerationDecision,
  type ModerationEnforcement,
  type ModerationStatus,
  type RouteModerationItem,
  type RouteModerationType,
} from '../moderationModel';

/**
 * Audit de modération des itinéraires (10.10), côté serveur, réservé aux modérateurs (`is_moderateur()`,
 * même mécanisme que `/api/admin/*`). Écritures sous RLS : `admin_audit_log` seulement (« admins_insert_audit_log » :
 * is_moderateur()) ; `moderation_queue` est la file des annonces de la place de marché et n'est jamais touchée. Le
 * statut d'un élément est la dernière décision du journal. Sources :
 *  - traces publiques : `community_posts` créés par « Publier le tracé » (`creation_meta.created_from = route_collab`) ;
 *  - commentaires et liens partagés : RPC `admin_list_route_moderation` (migration 20261123130000) ; si elle est
 *    absente ou en erreur, ces deux sources sont déclarées « indisponibles », jamais affichées vides.
 * Un REJET est APPLIQUÉ par la RPC `admin_apply_route_moderation` (masquer / supprimer un commentaire, révoquer un
 * lien, retirer une trace publique ; file + journal dans la même transaction) : `enforced: true`. Valider ou
 * signaler est seulement consigné (`enforced: false`) : il n'y a rien à appliquer.
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

    const { data: audit } = await client
      .from('admin_audit_log')
      .select('cible_type, cible_id, apres')
      .in('cible_type', [...ROUTE_MODERATION_TYPES])
      .order('created_at', { ascending: false })
      .limit(500);
    // Les 500 plus récentes, relues de la plus ancienne à la plus récente : la dernière décision gagne.
    const history = ((audit ?? []) as Array<Record<string, unknown>>).slice().reverse();
    return { status: 'ok', items: withAuditStatus(items, history), unavailable };
  } catch {
    return { status: 'error' };
  }
}

export type ModerationDecisionResult =
  | { status: 'ok'; enforced: boolean; applied?: 'applied' | 'noop'; statut: ModerationStatus }
  | { status: 'unauthenticated' | 'forbidden' | 'invalid' | 'not_found' | 'error' };

export async function decideRouteModeration(input: {
  type: RouteModerationType;
  id: string;
  decision: ModerationDecision;
  /** Rejet seulement ; défaut selon le type (`defaultEnforcement`). */
  action?: ModerationEnforcement;
}): Promise<ModerationDecisionResult> {
  try {
    const client = (await createClient()) as unknown as SupabaseClient;
    const who = await moderatorId(client);
    if (typeof who === 'string') return { status: who };

    if (input.decision === 'reject') {
      const action = input.action ?? defaultEnforcement(input.type);
      if (!isEnforcementAllowed(input.type, action)) return { status: 'invalid' };
      const { data, error } = await client.rpc('admin_apply_route_moderation', { p_kind: input.type, p_id: input.id, p_action: action });
      if (error) {
        const code = (error as { code?: string }).code;
        return { status: code === '42501' ? 'forbidden' : code === '22023' ? 'invalid' : 'error' };
      }
      const outcome = (data as { status?: string } | null)?.status;
      if (outcome === 'not_found') return { status: 'not_found' };
      if (outcome !== 'applied' && outcome !== 'noop') return { status: 'error' };
      return { status: 'ok', enforced: true, applied: outcome, statut: 'rejete' };
    }

    const { data: last } = await client
      .from('admin_audit_log')
      .select('apres')
      .eq('cible_type', input.type)
      .eq('cible_id', input.id.slice(0, 80))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const prior = (last as { apres?: { statut?: unknown } | null } | null)?.apres?.statut;
    const before = (typeof prior === 'string' ? prior : null) as ModerationStatus | null;
    const statut = statusOfDecision(input.decision);
    const audit = await client.from('admin_audit_log').insert(toAuditRow({ ...input, moderatorId: who.id, before }));
    if (audit.error) return { status: 'error' };
    return { status: 'ok', enforced: false, statut };
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
