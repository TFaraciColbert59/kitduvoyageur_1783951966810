/**
 * Appel client commun du suivi (`/api/compte/reseau/follow`).
 *
 * Le contrat est déjà verrouillé côté serveur : la route ne reçoit que la
 * cible, l'acteur vient du JWT, et la RPC décide entre suivi direct et
 * demande pour un profil privé. Ce module ne fait donc qu'un fetch borné,
 * avec un message d'erreur utilisable tel quel par l'UI.
 */

export type FollowStatus = 'following' | 'requested' | 'unfollowed';

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

/** Message sûr pour l'UI : le serveur ne renvoie que des erreurs bornées. */
export function followErrorMessage(error: unknown, fallback = FALLBACK_ERROR): string {
  return error instanceof ReseauFollowError && error.message.trim() ? error.message : fallback;
}
