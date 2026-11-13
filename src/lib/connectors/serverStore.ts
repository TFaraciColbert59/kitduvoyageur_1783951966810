import 'server-only';

import {
  IdempotentConnectorSyncEngine,
  type ConnectorConsentSnapshot,
  type PartnerProviderId,
} from '@/features/connectors';

/**
 * État serveur du lot D01-UI.
 *
 * Le lot amont (4c1c018) livre le registre et les moteurs purs, sans table de
 * persistance. Ce store isole donc l'état de session derrière une interface
 * étroite : snapshot de consentement, moteur de file idempotent, états OAuth
 * en attente et index athlète externe → utilisateur LKDV.
 *
 * Limite assumée et documentée : la mémoire est propre à l'instance Node.
 * Une migration `connector_consents` / `connector_sync_jobs` remplacera ce
 * store sans changer les routes ni les composants (même contrat).
 */

export interface ConnectorUserSession {
  readonly userId: string;
  snapshot: ConnectorConsentSnapshot;
  engine: IdempotentConnectorSyncEngine;
  lastSyncedAt: Partial<Record<PartnerProviderId, string>>;
}

export interface PendingOAuthState {
  state: string;
  userId: string;
  providerId: PartnerProviderId;
  codeVerifier: string;
  redirectUri: string;
  returnTo: string;
  createdAtMs: number;
}

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const sessions = new Map<string, ConnectorUserSession>();
const pendingOAuthStates = new Map<string, PendingOAuthState>();
const externalUserIndex = new Map<string, string>();

export const DEFAULT_POLICY_VERSION = 'd01-ui-v1';

export function createDefaultConsentSnapshot(userId: string): ConnectorConsentSnapshot {
  return {
    userId,
    policyVersion: DEFAULT_POLICY_VERSION,
    purposes: {
      personal_performance: false,
      collective_terrain: false,
      live_location: false,
      group_location: false,
      external_readiness: false,
    },
    providers: {},
  };
}

export function getConnectorSession(userId: string): ConnectorUserSession {
  const existing = sessions.get(userId);
  if (existing) return existing;
  const created: ConnectorUserSession = {
    userId,
    snapshot: createDefaultConsentSnapshot(userId),
    engine: new IdempotentConnectorSyncEngine(),
    lastSyncedAt: {},
  };
  sessions.set(userId, created);
  return created;
}

export function savePendingOAuthState(pending: PendingOAuthState): void {
  pendingOAuthStates.set(pending.state, pending);
}

export function consumePendingOAuthState(
  state: string,
  nowMs = Date.now()
): { ok: true; pending: PendingOAuthState } | { ok: false; reason: 'unknown' | 'expired' } {
  const pending = pendingOAuthStates.get(state);
  if (!pending) return { ok: false, reason: 'unknown' };
  pendingOAuthStates.delete(state);
  if (nowMs - pending.createdAtMs > OAUTH_STATE_TTL_MS) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, pending };
}

export function linkExternalAthlete(
  providerId: PartnerProviderId,
  externalAthleteId: string,
  userId: string
): void {
  externalUserIndex.set(`${providerId}:${externalAthleteId}`, userId);
}

export function findUserIdByExternalAthlete(
  providerId: PartnerProviderId,
  externalAthleteId: string
): string | null {
  return externalUserIndex.get(`${providerId}:${externalAthleteId}`) ?? null;
}

/** Remise à zéro réservée aux tests (aucun export utilisé en production). */
export function resetConnectorStoreForTests(): void {
  sessions.clear();
  pendingOAuthStates.clear();
  externalUserIndex.clear();
}
