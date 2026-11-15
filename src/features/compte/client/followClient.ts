/**
 * Appels clients communs du suivi.
 *
 * Les mutations passent par `/api/compte/reseau/follow` : la route ne reçoit
 * que la cible, l'acteur vient du JWT, et la RPC décide entre suivi direct et
 * demande pour un profil privé.
 *
 * La lecture initiale, elle, se fait sous RLS avec le client de session : les
 * droits existants laissent le compte courant lire ses propres lignes
 * `user_follows` et `follow_requests`. On ne lit donc jamais `user_profiles`
 * (profil privé) et on ne remonte aucun identifiant de demande à l'UI.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type FollowStatus = 'following' | 'requested' | 'unfollowed';

/** État affiché après un rechargement, avant toute mutation. */
export type FollowState = 'following' | 'requested' | 'none';

type FollowPayload = {
  status?: unknown;
  error?: unknown;
  code?: unknown;
};

export class ReseauFollowError extends Error {
  readonly code: string | null;
  readonly httpStatus: number;

  constructor(message: string, code: string | null, httpStatus: number) {
    super(message);
    this.name = 'ReseauFollowError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const FALLBACK_ERROR = 'Impossible de mettre à jour cet abonnement.';

function readPayload(value: unknown): FollowPayload {
  return value && typeof value === 'object' ? (value as FollowPayload) : {};
}

/** Suit (POST) ou ne suit plus (DELETE) une cible via l'API testée. */
export async function setFollow(targetId: string, action: 'follow' | 'unfollow'): Promise<FollowStatus> {
  const response = await fetch('/api/compte/reseau/follow', {
    method: action === 'follow' ? 'POST' : 'DELETE',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ userId: targetId }),
  });
  const payload = readPayload(await response.json().catch(() => null));

  if (!response.ok) {
    const message = typeof payload.error === 'string' && payload.error.trim() ? payload.error : FALLBACK_ERROR;
    const code = typeof payload.code === 'string' ? payload.code : null;
    throw new ReseauFollowError(message, code, response.status);
  }

  if (action === 'unfollow') return 'unfollowed';
  if (payload.status === 'following' || payload.status === 'requested') return payload.status;
  throw new ReseauFollowError(FALLBACK_ERROR, 'invalid_response', response.status);
}

type FollowRow = { following_id?: string | null };
type FollowRequestRow = { target_id?: string | null; status?: string | null };

/**
 * Décide l'état à partir des lignes déjà lues. Fonction pure : les fixtures de
 * test couvrent following / requested / none sans simuler PostgREST.
 *
 * Un suivi réel prime toujours sur une demande encore marquée `pending` : une
 * acceptation peut laisser les deux lignes visibles le temps de la propagation.
 */
export function resolveFollowState(
  follows: readonly FollowRow[] | null | undefined,
  requests: readonly FollowRequestRow[] | null | undefined,
  targetId: string
): FollowState {
  if ((follows ?? []).some((row) => row?.following_id === targetId)) return 'following';
  if (
    (requests ?? []).some(
      (row) => row?.target_id === targetId && row.status === 'pending'
    )
  ) {
    return 'requested';
  }
  return 'none';
}

const STATE_FALLBACK = 'Impossible de charger l’état de suivi.';

/**
 * Lit l'état initial du compte courant vers une cible.
 *
 * Deux requêtes parallèles, filtrées sur le compte courant. La demande est lue
 * dans `follow_requests` avec les droits RLS existants (`requester_id =
 * auth.uid()`) ; aucun profil privé n'est consulté et la demande n'expose pas
 * son `id`. Les erreurs restent bornées pour que l'UI garde son état courant.
 */
export async function loadFollowState(
  supabase: Pick<SupabaseClient, 'from'>,
  viewerId: string,
  targetId: string
): Promise<FollowState> {
  if (!viewerId || !targetId || viewerId === targetId) return 'none';

  const [follows, requests] = await Promise.all([
    supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', viewerId)
      .eq('following_id', targetId)
      .limit(1),
    supabase
      .from('follow_requests')
      .select('target_id, status')
      .eq('requester_id', viewerId)
      .eq('target_id', targetId)
      .eq('status', 'pending')
      .limit(1),
  ]);

  if (follows.error || requests.error) {
    throw new ReseauFollowError(STATE_FALLBACK, 'state_failed', 0);
  }

  return resolveFollowState(follows.data, requests.data, targetId);
}

/** Message sûr pour l'UI : le serveur ne renvoie que des erreurs bornées. */
export function followErrorMessage(error: unknown, fallback = FALLBACK_ERROR): string {
  return error instanceof ReseauFollowError && error.message.trim() ? error.message : fallback;
}
