/**
 * Communauté v2 — mutations du tiroir Explorer.
 *
 * Toutes les écritures passent par les RPC du contrat (`RPC-CONTRACTS.md` § 3)
 * ou, pour le j'aime de carnet, par la table `carnet_likes` sous RLS (aucune RPC
 * nouvelle au contrat, même mutation que la fiche carnet v2). Aucune écriture
 * de compteur côté client : `members_count` et `current_participants` sont
 * recalculés par les RPC.
 *
 * Chaque fonction renvoie un `MutationResult` prêt pour l'île dynamique :
 * `{ ok: true, data }` ou `{ ok: false, code, message, field }`. Les erreurs
 * applicatives des RPC arrivent en JSON `{"code","message","field"}` dans
 * `MESSAGE` (SQLSTATE P0001) : elles sont décodées **une seule fois**, ici.
 */

import { getDataClient, type DataClientLike } from './communityFeedRpc';
import { callRpc } from './communityFeedRpc';

export interface MutationSuccess<T> {
  ok: true;
  data: T;
}

export interface MutationFailure {
  ok: false;
  code: string | null;
  message: string;
  field: string | null;
}

export type MutationResult<T = undefined> = MutationSuccess<T> | MutationFailure;

/** Message générique quand le serveur ne fournit pas de texte lisible. */
const FALLBACK_MESSAGE = 'Action impossible pour le moment. Réessaie.';

/**
 * Décode une erreur de RPC : JSON applicatif `{code,message,field?}` d'abord,
 * message brut (trigger/contrainte) ensuite, texte de repli en dernier.
 */
export function parseMutationError(error: unknown): MutationFailure {
  const source =
    error && typeof error === 'object'
      ? (error as { message?: unknown; code?: unknown })
      : null;
  const raw = typeof source?.message === 'string' ? source.message.trim() : '';
  const fallbackCode = typeof source?.code === 'string' ? source.code : null;
  if (!raw) {
    return { ok: false, code: fallbackCode, message: FALLBACK_MESSAGE, field: null };
  }
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { code?: unknown; message?: unknown; field?: unknown };
      const message =
        typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message.trim() : FALLBACK_MESSAGE;
      return {
        ok: false,
        code: typeof parsed.code === 'string' ? parsed.code : fallbackCode,
        message,
        field: typeof parsed.field === 'string' ? parsed.field : null,
      };
    } catch {
      /* message non JSON : traité comme message brut ci-dessous */
    }
  }
  return { ok: false, code: fallbackCode, message: raw, field: null };
}

function success<T>(data: T): MutationSuccess<T> {
  return { ok: true, data };
}

// ── Clubs ─────────────────────────────────────────────────────────────────

export type ClubJoinOutcome = 'member' | 'pending';

/** `join_club` : adhésion directe (`member`) ou demande (`pending`). */
export async function joinClub(
  clubId: string,
  answers: string[] = [],
  client: DataClientLike = getDataClient(),
): Promise<MutationResult<ClubJoinOutcome>> {
  const { data, error } = await callRpc<unknown>(
    'join_club',
    { p_club: clubId, p_answers: answers },
    client,
  );
  if (error) return parseMutationError(error);
  return success(data === 'pending' ? 'pending' : 'member');
}

/** `leave_club` : `left` ou `none` (dernier admin traduit en `last_admin`). */
export async function leaveClub(
  clubId: string,
  client: DataClientLike = getDataClient(),
): Promise<MutationResult<'left' | 'none'>> {
  const { data, error } = await callRpc<unknown>('leave_club', { p_club: clubId }, client);
  if (error) return parseMutationError(error);
  return success(data === 'left' ? 'left' : 'none');
}

/** `cancel_join_request` : annule la demande pending du lecteur. */
export async function cancelJoinRequest(
  clubId: string,
  client: DataClientLike = getDataClient(),
): Promise<MutationResult<'cancelled' | 'none'>> {
  const { data, error } = await callRpc<unknown>('cancel_join_request', { p_club: clubId }, client);
  if (error) return parseMutationError(error);
  return success(data === 'cancelled' ? 'cancelled' : 'none');
}

export interface ReviewJoinRequestOutcome {
  status: string;
  changed: boolean;
  membersCount: number | null;
}

/** `review_join_request` (admin/modérateur actif) : accepte ou refuse une demande. */
export async function reviewJoinRequest(
  requestId: string,
  approve: boolean,
  client: DataClientLike = getDataClient(),
): Promise<MutationResult<ReviewJoinRequestOutcome>> {
  const { data, error } = await callRpc<unknown>(
    'review_join_request',
    { p_request: requestId, p_approve: approve },
    client,
  );
  if (error) return parseMutationError(error);
  const payload = (data ?? {}) as {
    status?: unknown;
    changed?: unknown;
    members_count?: unknown;
  };
  const membersCount =
    typeof payload.members_count === 'number'
      ? payload.members_count
      : typeof payload.members_count === 'string' && payload.members_count.trim() !== ''
        ? Number(payload.members_count)
        : null;
  return success({
    status: typeof payload.status === 'string' ? payload.status : approve ? 'approved' : 'rejected',
    changed: Boolean(payload.changed),
    membersCount: membersCount != null && Number.isFinite(membersCount) ? membersCount : null,
  });
}

// ── Sorties ───────────────────────────────────────────────────────────────

export interface EventRegistrationOutcome {
  registered: boolean;
  waitlisted: boolean;
  currentParticipants: number | null;
}

function readEventRegistration(payload: unknown): EventRegistrationOutcome {
  // Le contrat réel renvoie un objet `{registered, waitlisted, current_participants}`.
  // Les harnais de recette antérieurs peuvent renvoyer une chaîne `'in'|'wait'` :
  // on la décode sans jamais inventer d'état (aucune clé → aucun changement).
  if (typeof payload === 'string') {
    const value = payload.trim().toLowerCase();
    return {
      registered: value === 'in' || value === 'registered',
      waitlisted: value === 'wait' || value === 'waitlist',
      currentParticipants: null,
    };
  }
  const value = (payload ?? {}) as {
    registered?: unknown;
    waitlisted?: unknown;
    current_participants?: unknown;
  };
  const current =
    typeof value.current_participants === 'number'
      ? value.current_participants
      : Number(value.current_participants);
  return {
    registered: Boolean(value.registered),
    waitlisted: Boolean(value.waitlisted),
    currentParticipants: Number.isFinite(current) ? current : null,
  };
}

/** `join_event` : confirme une inscription ou bascule en liste d'attente. */
export async function joinEvent(
  eventId: string,
  client: DataClientLike = getDataClient(),
): Promise<MutationResult<EventRegistrationOutcome>> {
  const { data, error } = await callRpc<unknown>('join_event', { p_event_id: eventId }, client);
  if (error) return parseMutationError(error);
  return success(readEventRegistration(data));
}

/** `leave_event` : désinscription ; promeut automatiquement la liste d'attente. */
export async function leaveEvent(
  eventId: string,
  client: DataClientLike = getDataClient(),
): Promise<MutationResult<EventRegistrationOutcome & { promotedUserId: string | null }>> {
  const { data, error } = await callRpc<unknown>('leave_event', { p_event_id: eventId }, client);
  if (error) return parseMutationError(error);
  const payload = (data ?? {}) as { promoted?: unknown };
  return success({
    ...readEventRegistration(data),
    promotedUserId: typeof payload.promoted === 'string' ? payload.promoted : null,
  });
}

// ── J'aime de carnet (Carnets#8) ─────────────────────────────────────────

/**
 * J'aime un carnet depuis la tuile, sans ouvrir la fiche. Même mutation que
 * `useCarnetEngagement` (fiche carnet v2) : `upsert` sur `carnet_likes` avec
 * `reaction: 'like'` (aucune contrainte de réaction en production), `delete`
 * pour retirer. La RLS limite l'écriture à `user_id = auth.uid()`.
 */
export async function setCarnetLike(
  carnetId: string,
  liked: boolean,
  userId: string,
  client: DataClientLike = getDataClient(),
): Promise<MutationResult> {
  try {
    if (liked) {
      const { error } = await client
        .from('carnet_likes')
        .upsert({ carnet_id: carnetId, user_id: userId, reaction: 'like' }, { onConflict: 'carnet_id,user_id' });
      if (error) return parseMutationError(error);
    } else {
      const { error } = await client
        .from('carnet_likes')
        .delete()
        .eq('carnet_id', carnetId)
        .eq('user_id', userId);
      if (error) return parseMutationError(error);
    }
    return success(undefined);
  } catch (cause) {
    return parseMutationError(cause);
  }
}
