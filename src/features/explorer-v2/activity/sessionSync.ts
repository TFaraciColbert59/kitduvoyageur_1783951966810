'use client';

/**
 * Synchronisation d'une séance avec le serveur.
 *
 * Le client garde l'identité et les points localement ; ce module ne fait que
 * les pousser dans l'ordre :
 *   1. `start_activity_session` (idempotent sur `clientSessionId`) ;
 *   2. `sync_activity_session` (points séquencés + métriques) ;
 *   3. `finish_activity_session_idempotent` (clé stable).
 *
 * Une réponse perdue est sans danger : les points sont rejoués avec la même
 * séquence et la RPC ignore les doublons ; la fin est rejouée avec la même clé.
 * Aucune simulation : les points viennent de `readSessionPoints`.
 */

import type { FinishOutcome } from './finishOutcome';
import { readFinishOutcome } from './finishOutcome';
import {
  isUuid,
  readLocalSession,
  readSessionPoints,
  updateLocalSession,
  type LocalSessionPoint,
  type LocalSessionRecord,
} from './localSession';
import type { Sport } from '../state/types';

const POINT_BATCH_SIZE = 200;

export type SessionSyncReason =
  | 'unauthenticated'
  | 'retryable'
  | 'conflict'
  | 'rejected'
  | 'invalid';

export interface SessionSyncDeps {
  getToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export type StartServerResult =
  | {
      ok: true;
      sessionId: string;
      sessionStatus: string;
      created: boolean;
    }
  | { ok: false; reason: SessionSyncReason };

export async function defaultAccessToken(): Promise<string | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function resolveToken(deps: SessionSyncDeps): Promise<string | null> {
  if (deps.getToken) return deps.getToken();
  return defaultAccessToken();
}

function resolveFetch(deps: SessionSyncDeps): typeof fetch {
  return deps.fetchImpl ?? fetch;
}

export async function startServerSession(
  clientSessionId: string,
  sport: Sport,
  variantId: string | null,
  deps: SessionSyncDeps = {},
): Promise<StartServerResult> {
  const token = await resolveToken(deps);
  if (!token) return { ok: false, reason: 'unauthenticated' };

  try {
    const response = await resolveFetch(deps)('/api/explorer/v2/activity/start', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientSessionId, sport, variantId }),
    });
    if (response.status === 401) return { ok: false, reason: 'unauthenticated' };
    if (response.status === 409) return { ok: false, reason: 'conflict' };
    if (response.status === 400 || response.status === 422) {
      return { ok: false, reason: 'rejected' };
    }
    if (!response.ok) return { ok: false, reason: 'retryable' };

    const payload = (await response.json().catch(() => null)) as
      | { sessionId?: unknown; sessionStatus?: unknown; created?: unknown }
      | null;
    const sessionId = payload?.sessionId;
    const sessionStatus = payload?.sessionStatus;
    if (!isUuid(sessionId) || typeof sessionStatus !== 'string') {
      return { ok: false, reason: 'invalid' };
    }
    return {
      ok: true,
      sessionId,
      sessionStatus,
      created: payload?.created === true,
    };
  } catch {
    return { ok: false, reason: 'retryable' };
  }
}

export type EnsureSessionResult =
  | { ok: true; sessionId: string; record: LocalSessionRecord }
  | { ok: false; reason: SessionSyncReason };

export async function ensureServerSession(
  record: LocalSessionRecord,
  deps: SessionSyncDeps = {},
): Promise<EnsureSessionResult> {
  if (isUuid(record.serverSessionId)) {
    return { ok: true, sessionId: record.serverSessionId, record };
  }
  const started = await startServerSession(
    record.clientSessionId,
    record.sport,
    record.selection?.variantId ?? null,
    deps,
  );
  if (!started.ok) return started;
  if (started.sessionStatus === 'finished' || started.sessionStatus === 'abandoned') {
    // Une autre source a clos la séance : ne jamais la réouvrir implicitement.
    return { ok: false, reason: 'conflict' };
  }
  const updated = await updateLocalSession(record.clientSessionId, {
    serverSessionId: started.sessionId,
  });
  return {
    ok: true,
    sessionId: started.sessionId,
    record: updated ?? { ...record, serverSessionId: started.sessionId, updatedAt: Date.now() },
  };
}

interface PointsResponse {
  inserted?: unknown;
  received?: unknown;
  syncedThroughSeq?: unknown;
}

function parsePointsResponse(value: unknown, expected: number): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as PointsResponse;
  if (typeof payload.received !== 'number' || payload.received !== expected) return null;
  if (typeof payload.inserted !== 'number' || payload.inserted < 0) return null;
  if (typeof payload.syncedThroughSeq !== 'number' || !Number.isFinite(payload.syncedThroughSeq)) {
    return null;
  }
  return payload.syncedThroughSeq;
}

function pointBody(point: LocalSessionPoint): Record<string, unknown> {
  return {
    seq: point.seq,
    t: point.t,
    lat: point.lat,
    lng: point.lng,
    ele: point.ele ?? null,
    acc: point.acc ?? null,
    speed: point.speed ?? null,
  };
}

export type SyncPointsResult =
  | { ok: true; record: LocalSessionRecord; syncedThroughSeq: number }
  | { ok: false; reason: SessionSyncReason };

/**
 * Pousse les points non acquittés puis les métriques courantes. Le curseur
 * `syncedThroughSeq` n'avance qu'après une réponse valide ; un renvoi du même
 * lot est acquitté sans doublon par l'index unique `(session_id, client_seq)`.
 */
export async function syncPendingPoints(
  record: LocalSessionRecord,
  deps: SessionSyncDeps = {},
): Promise<SyncPointsResult> {
  const ensured = await ensureServerSession(record, deps);
  if (!ensured.ok) return ensured;
  const token = await resolveToken(deps);
  if (!token) return { ok: false, reason: 'unauthenticated' };
  const allPoints = await readSessionPoints(record.clientSessionId);
  const pending = allPoints.filter((point) => point.seq > ensured.record.syncedThroughSeq);

  let current = ensured.record;
  let cursor = current.syncedThroughSeq;

  do {
    const chunk = pending.filter((point) => point.seq > cursor).slice(0, POINT_BATCH_SIZE);
    try {
      const response = await resolveFetch(deps)('/api/explorer/v2/activity/points', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: ensured.sessionId,
          startedAt: current.startedAt,
          endedAt: current.endedAt,
          points: chunk.map(pointBody),
          metrics: {
            distanceM: current.distanceM,
            elevGainM: current.elevGainM,
            movingS: current.movingS,
            paused: current.paused,
          },
        }),
      });
      if (response.status === 401) return { ok: false, reason: 'unauthenticated' };
      if (response.status === 409) return { ok: false, reason: 'conflict' };
      if (response.status === 400 || response.status === 422) {
        return { ok: false, reason: 'rejected' };
      }
      if (!response.ok) return { ok: false, reason: 'retryable' };

      const payload = await response.json().catch(() => null);
      const ack = parsePointsResponse(payload, chunk.length);
      if (ack === null || (chunk.length > 0 && ack < chunk[chunk.length - 1].seq)) {
        return { ok: false, reason: 'retryable' };
      }
      cursor = Math.max(cursor, ack);
      current = {
        ...current,
        syncedThroughSeq: cursor,
        updatedAt: Date.now(),
      };
      await updateLocalSession(current.clientSessionId, {
        syncedThroughSeq: cursor,
      });
    } catch {
      return { ok: false, reason: 'retryable' };
    }
  } while (pending.some((point) => point.seq > cursor));

  // Une requête vide est volontairement envoyée quand aucun point n'est en
  // attente : elle pousse les métriques courantes (distance, D+, pause).
  return { ok: true, record: current, syncedThroughSeq: cursor };
}

export type FinishSessionResult =
  | { ok: true; outcome: FinishOutcome; record: LocalSessionRecord; sessionId: string }
  | { ok: false; reason: SessionSyncReason; record: LocalSessionRecord };

function outcomeToReason(outcome: FinishOutcome): SessionSyncReason | null {
  if (outcome.terminal) return null;
  if (outcome.state === 'unauthenticated') return 'unauthenticated';
  return 'retryable';
}

/**
 * Fin complète : sécurise l'identité serveur, pousse les derniers points puis
 * clôt. Un échec non terminal laisse la fiche active et la fin en file.
 */
export async function finishSession(
  record: LocalSessionRecord,
  deps: SessionSyncDeps = {},
): Promise<FinishSessionResult> {
  let current = record;

  // Une séance déjà close côté serveur peut encore recevoir des points : le
  // RPC de progression renvoie alors un conflit. On tente quand même la fin
  // idempotente, qui répondra `already_finished` sans réécrire.
  const synced = await syncPendingPoints(current, deps);
  if (synced.ok) {
    current = synced.record;
  } else if (synced.reason !== 'conflict') {
    return { ok: false, reason: synced.reason, record: current };
  }

  const ensured = await ensureServerSession(current, deps);
  if (!ensured.ok) return { ok: false, reason: ensured.reason, record: current };
  current = ensured.record;

  const token = await resolveToken(deps);
  if (!token) return { ok: false, reason: 'unauthenticated', record: current };

  const idempotencyKey = `activity.finish:${current.clientSessionId}`;
  try {
    const response = await resolveFetch(deps)('/api/explorer/v2/activity/finish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId: ensured.sessionId, idempotencyKey }),
    });
    const payload = await response.json().catch(() => null);
    const outcome = readFinishOutcome(response.status, payload);
    const nonTerminalReason = outcomeToReason(outcome);
    const next: LocalSessionRecord = {
      ...current,
      status: outcome.terminal ? 'finished' : current.status,
      summarySaved: outcome.state,
      updatedAt: Date.now(),
    };
    await updateLocalSession(current.clientSessionId, {
      // Ne jamais ramener une fiche terminée à « active » sur un 401/5xx :
      // seule une réponse terminale fixe le statut.
      ...(outcome.terminal ? { status: 'finished' as const } : {}),
      summarySaved: outcome.state,
    });
    if (nonTerminalReason) {
      return { ok: false, reason: nonTerminalReason, record: next };
    }
    return { ok: true, outcome, record: next, sessionId: ensured.sessionId };
  } catch {
    return { ok: false, reason: 'retryable', record: current };
  }
}

/**
 * Rejoue une fin dont la fiche locale a disparu (entrée de file créée par un
 * ancien client). Aucun point n'est inventé : la RPC peut répondre
 * `already_finished` avec ou sans résumé.
 */
export async function finishSessionById(
  sessionId: string,
  idempotencyKey: string,
  deps: SessionSyncDeps = {},
): Promise<FinishOutcome | null> {
  const token = await resolveToken(deps);
  if (!token) return null;
  try {
    const response = await resolveFetch(deps)('/api/explorer/v2/activity/finish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, idempotencyKey }),
    });
    const payload = await response.json().catch(() => null);
    return readFinishOutcome(response.status, payload);
  } catch {
    return null;
  }
}

export async function loadSessionForSync(clientSessionId: string): Promise<LocalSessionRecord | null> {
  return readLocalSession(clientSessionId);
}
