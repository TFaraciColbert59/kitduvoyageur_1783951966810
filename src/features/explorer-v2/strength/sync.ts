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
 */

import { defaultAccessToken } from '../activity/sessionSync';
import type { StrengthLog } from '../state/types';
import {
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
  fetchImpl?: typeof fetch;
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

async function resolveToken(deps: StrengthSyncDeps): Promise<string | null> {
  if (deps.getToken) return deps.getToken();
  return defaultAccessToken();
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
): Promise<StrengthPushResult> {
  const snapshot = cloneStrengthLog(log);
  const run = writeChain.then(() => pushStrengthLog(snapshot, deps));
  writeChain = run.catch(() => undefined);
  return run;
}

/**
 * Attend les écritures déjà programmées. Utilisé avant une suppression :
 * une synchronisation partie juste avant l’effacement ne doit pas recréer le
 * carnet après la suppression.
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
): Promise<StrengthPushResult> {
  const token = await resolveToken(deps);
  if (!token) return { ok: false, reason: 'unauthenticated' };

  // Un carnet dont la suppression est encore en file ne doit jamais être
  // recréé par une synchronisation tardive.
  const pendingDeletions = readStrengthDeletions();
  if (pendingDeletions.some((item) => item.id === log.id)) {
    return { ok: false, reason: 'conflict' };
  }

  // Une suppression demandée hors ligne ne doit pas attendre un remontage :
  // elle est rejouée avant l’écriture du brouillon courant. Un échec ne bloque
  // pas la sauvegarde du carnet, il laisse seulement la suppression en file.
  if (pendingDeletions.length > 0) {
    await flushStrengthDeletions(deps);
  }

  try {
    const response = await resolveFetch(deps)(ENDPOINT, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ log }),
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
): Promise<StrengthReadResult> {
  const token = await resolveToken(deps);
  if (!token) return { ok: false, reason: 'unauthenticated' };

  const url = logId ? `${ENDPOINT}?logId=${encodeURIComponent(logId)}` : ENDPOINT;
  try {
    const response = await resolveFetch(deps)(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
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
): Promise<StrengthDeleteResult> {
  const token = await resolveToken(deps);
  if (!token) return { ok: false, reason: 'unauthenticated' };

  try {
    const response = await resolveFetch(deps)(
      `${ENDPOINT}?logId=${encodeURIComponent(logId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
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
 * Rejoue les suppressions en attente. Une suppression acquittée est retirée
 * de la file ; un échec la laisse en place pour la prochaine occasion.
 */
export async function flushStrengthDeletions(
  deps: StrengthSyncDeps = {},
): Promise<StrengthFlushResult> {
  const pending = readStrengthDeletions();
  if (pending.length === 0) return { ok: true, pending: 0 };

  let lastReason: StrengthSyncReason | undefined;
  for (const item of pending) {
    const result = await deleteRemoteStrengthLog(item.id, deps);
    if (result.ok) {
      removeStrengthDeletion(item.id);
      continue;
    }
    lastReason = result.reason;
    if (result.reason === 'unauthenticated') break;
  }

  const remaining = readStrengthDeletions();
  return {
    ok: remaining.length === 0,
    pending: remaining.length,
    ...(lastReason ? { reason: lastReason } : {}),
  };
}
