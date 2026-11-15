'use client';

/**
 * Synchronisation du carnet de musculation avec le compte (S2.32).
 *
 * Le brouillon local est écrit avant tout appel réseau. Ce module pousse
 * ensuite l’état complet vers la route `/api/explorer/v2/strength/log`, qui
 * relaie le jeton utilisateur à PostgREST et laisse la RPC vérifier
 * `auth.uid()`. Aucun identifiant d’acteur n’est lu dans le corps.
 *
 * Une panne réseau ne perd rien : le brouillon reste dans `localStorage` et
 * sera repoussé au prochain montage, au retour de la connexion ou après une
 * nouvelle saisie. Les suppressions demandées hors ligne sont conservées dans
 * une file locale pour ne jamais ressusciter un carnet effacé.
 *
 * Depuis la fin de S2.32, chaque écriture est liée au propriétaire local du
 * brouillon. Un brouillon non rattaché n’est jamais poussé automatiquement
 * vers le compte qui se connecte : il faut le geste explicite de récupération
 * dans l’écran. Une écriture partie avant un changement de compte ne peut pas
 * atterrir sur le nouveau compte : l’identité de session est revérifiée.
 */

import type { StrengthLog } from '../state/types';
import {
  getStrengthStorageOwner,
  readStrengthDeletions,
  removeStrengthDeletion,
  parseStrengthLog,
} from './storage';

const ENDPOINT = '/api/explorer/v2/strength/log';

export type StrengthSyncReason =
  | 'unauthenticated'
  | 'retryable'
  | 'rejected'
  | 'invalid'
  | 'conflict';

export interface StrengthSyncDeps {
  getToken?: () => Promise<string | null>;
  /** Identité correspondant au jeton injecté ; absente en production (déduite de la session). */
  getUserId?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

interface StrengthIdentity {
  token: string;
  userId: string | null;
}

export type StrengthPushResult =
  | { ok: true; revision: number; updatedAt: string | null }
  | { ok: false; reason: StrengthSyncReason };

export type StrengthReadResult =
  | { ok: true; log: StrengthLog | null }
  | { ok: false; reason: StrengthSyncReason };

export type StrengthDeleteResult =
  | { ok: true; deleted: boolean }
  | { ok: false; reason: StrengthSyncReason };

function resolveFetch(deps: StrengthSyncDeps): typeof fetch {
  return deps.fetchImpl ?? fetch;
}

async function defaultAuthIdentity(): Promise<StrengthIdentity | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    const userId = data.session?.user?.id;
    if (!token || !userId) return null;
    return { token, userId };
  } catch {
    return null;
  }
}

async function resolveIdentity(deps: StrengthSyncDeps): Promise<StrengthIdentity | null> {
  if (deps.getToken) {
    const token = await deps.getToken();
    if (!token) return null;
    const userId = deps.getUserId ? await deps.getUserId() : null;
    return { token, userId };
  }
  return defaultAuthIdentity();
}

/**
 * Refuse une écriture si le propriétaire local et la session ne concordent pas.
 * En production, un brouillon sans propriétaire (ancienne clé non récupérée)
 * n’est jamais poussé : il doit d’abord être rattaché explicitement.
 */
function ownerRejection(
  ownerId: string | null,
  identity: StrengthIdentity,
  usesInjectedIdentity: boolean,
): StrengthSyncReason | null {
  if (!usesInjectedIdentity && ownerId === null) return 'unauthenticated';
  if (ownerId !== null && identity.userId !== null && identity.userId !== ownerId) {
    return 'conflict';
  }
  return null;
}

function reasonForStatus(status: number): StrengthSyncReason {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'rejected';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'rejected';
  return 'retryable';
}

function cloneStrengthLog(log: StrengthLog): StrengthLog {
  return {
    ...log,
    exercises: log.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set })),
    })),
  };
}

/**
 * Réponses sérialisées dans l’ordre des saisies. Deux modifications rapides ne
 * peuvent donc pas s’écrire dans le désordre et laisser l’ancienne gagner.
 */
let writeChain: Promise<unknown> = Promise.resolve();

export function queueStrengthPush(
  log: StrengthLog,
  deps: StrengthSyncDeps = {},
  ownerId: string | null = getStrengthStorageOwner(),
): Promise<StrengthPushResult> {
  const snapshot = cloneStrengthLog(log);
  const run = writeChain.then(() => pushStrengthLog(snapshot, deps, ownerId));
  writeChain = run.catch(() => undefined);
  return run;
}

/**
 * Attend les écritures déjà programmées. Utilisé avant une suppression :
 * une synchronisation partie juste avant l’effacement ne doit pas recréer le
 * carnet après la suppression. Également utilisé avant de changer de compte
 * pour ne pas mélanger deux propriétaires.
 */
export async function waitForStrengthWrites(): Promise<void> {
  let current = writeChain;
  for (;;) {
    await current.catch(() => undefined);
    if (current === writeChain) return;
    current = writeChain;
  }
}

export async function pushStrengthLog(
  log: StrengthLog,
  deps: StrengthSyncDeps = {},
  ownerId: string | null = getStrengthStorageOwner(),
): Promise<StrengthPushResult> {
  const usesInjectedIdentity = Boolean(deps.getToken);
  const identity = await resolveIdentity(deps);
  if (!identity) return { ok: false, reason: 'unauthenticated' };
  const rejected = ownerRejection(ownerId, identity, usesInjectedIdentity);
  if (rejected) return { ok: false, reason: rejected };

  // Un carnet dont la suppression est encore en file ne doit jamais être
  // recréé par une synchronisation tardive.
  const pendingDeletions = readStrengthDeletions(ownerId);
  if (pendingDeletions.some((item) => item.id === log.id)) {
    return { ok: false, reason: 'conflict' };
  }

  // Une suppression demandée hors ligne ne doit pas attendre un remontage :
  // elle est rejouée avant l’écriture du brouillon courant. Un échec ne bloque
  // pas la sauvegarde du carnet, il laisse seulement la suppression en file.
  if (pendingDeletions.length > 0) {
    await flushStrengthDeletions(deps, ownerId);
  }

  // Le lien de séance est un champ de premier niveau du contrat serveur ; il
  // ne fait pas partie de `p_log`. On le retire donc du carnet transmis.
  const { activitySessionId, ...logWithoutSession } = log;
  const body: { log: Omit<StrengthLog, 'activitySessionId'>; activitySessionId?: string } = {
    log: logWithoutSession,
  };
  if (activitySessionId) body.activitySessionId = activitySessionId;

  try {
    const response = await resolveFetch(deps)(ENDPOINT, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${identity.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return { ok: false, reason: reasonForStatus(response.status) };

    const payload = (await response.json().catch(() => null)) as
      | { ok?: unknown; revision?: unknown; updatedAt?: unknown }
      | null;
    if (
      !payload ||
      payload.ok !== true ||
      typeof payload.revision !== 'number' ||
      !Number.isInteger(payload.revision) ||
      payload.revision < 1
    ) {
      return { ok: false, reason: 'invalid' };
    }

    return {
      ok: true,
      revision: payload.revision,
      updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
    };
  } catch {
    return { ok: false, reason: 'retryable' };
  }
}

export async function fetchRemoteStrengthLog(
  logId?: string,
  deps: StrengthSyncDeps = {},
  ownerId: string | null = getStrengthStorageOwner(),
): Promise<StrengthReadResult> {
  const usesInjectedIdentity = Boolean(deps.getToken);
  const identity = await resolveIdentity(deps);
  if (!identity) return { ok: false, reason: 'unauthenticated' };
  const rejected = ownerRejection(ownerId, identity, usesInjectedIdentity);
  if (rejected) return { ok: false, reason: rejected };

  const url = logId ? `${ENDPOINT}?logId=${encodeURIComponent(logId)}` : ENDPOINT;
  try {
    const response = await resolveFetch(deps)(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${identity.token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { ok: false, reason: reasonForStatus(response.status) };

    const payload = (await response.json().catch(() => null)) as { log?: unknown } | null;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, reason: 'invalid' };
    }
    if (payload.log === null || payload.log === undefined) {
      return { ok: true, log: null };
    }
    const log = parseStrengthLog(payload.log);
    if (!log) return { ok: false, reason: 'invalid' };
    return { ok: true, log };
  } catch {
    return { ok: false, reason: 'retryable' };
  }
}

export async function deleteRemoteStrengthLog(
  logId: string,
  deps: StrengthSyncDeps = {},
  ownerId: string | null = getStrengthStorageOwner(),
): Promise<StrengthDeleteResult> {
  const usesInjectedIdentity = Boolean(deps.getToken);
  const identity = await resolveIdentity(deps);
  if (!identity) return { ok: false, reason: 'unauthenticated' };
  const rejected = ownerRejection(ownerId, identity, usesInjectedIdentity);
  if (rejected) return { ok: false, reason: rejected };

  try {
    const response = await resolveFetch(deps)(
      `${ENDPOINT}?logId=${encodeURIComponent(logId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${identity.token}` },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) return { ok: false, reason: reasonForStatus(response.status) };

    const payload = (await response.json().catch(() => null)) as { deleted?: unknown } | null;
    if (!payload || typeof payload.deleted !== 'boolean') {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, deleted: payload.deleted };
  } catch {
    return { ok: false, reason: 'retryable' };
  }
}

export interface StrengthFlushResult {
  ok: boolean;
  pending: number;
  reason?: StrengthSyncReason;
}

/**
 * Rejoue les suppressions en attente du propriétaire courant. Une suppression
 * acquittée est retirée de la file ; un échec la laisse en place pour la
 * prochaine occasion.
 */
export async function flushStrengthDeletions(
  deps: StrengthSyncDeps = {},
  ownerId: string | null = getStrengthStorageOwner(),
): Promise<StrengthFlushResult> {
  const pending = readStrengthDeletions(ownerId);
  if (pending.length === 0) return { ok: true, pending: 0 };

  let lastReason: StrengthSyncReason | undefined;
  for (const item of pending) {
    const result = await deleteRemoteStrengthLog(item.id, deps, ownerId);
    if (result.ok) {
      removeStrengthDeletion(item.id, ownerId);
      continue;
    }
    lastReason = result.reason;
    if (result.reason === 'unauthenticated') break;
  }

  const remaining = readStrengthDeletions(ownerId);
  return {
    ok: remaining.length === 0,
    pending: remaining.length,
    ...(lastReason ? { reason: lastReason } : {}),
  };
}
