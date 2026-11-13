import { describe, expect, it } from 'vitest';

import {
  resolveConnectorState,
  type ConnectorConsentSnapshot,
  type ConnectorEnvReader,
  type SyncQueueJob,
} from '@/features/connectors';
import {
  buildConnectorCard,
  buildRouteSendTargets,
  buildSyncJobView,
  groupConnectorCards,
  summarizeCatalog,
  summarizeSyncQueue,
} from '../viewModels';

const CONFIGURED_ENV: ConnectorEnvReader = {
  GARMIN_CLIENT_ID: 'garmin_id',
  GARMIN_CLIENT_SECRET: 'garmin_secret',
  GARMIN_WEBHOOK_SECRET: 'garmin_webhook',
  WAHOO_CLIENT_ID: 'wahoo_id',
  WAHOO_CLIENT_SECRET: 'wahoo_secret',
  WAHOO_WEBHOOK_SECRET: 'wahoo_webhook',
};

function grantedSnapshot(): ConnectorConsentSnapshot {
  return {
    userId: 'user-1',
    policyVersion: 'd01-ui-test',
    purposes: { personal_performance: true, collective_terrain: true },
    providers: {
      garmin: {
        providerId: 'garmin',
        connected: true,
        allowedScopes: ['activity_import', 'route_export', 'waypoint_export', 'live_sync'],
        grantedAt: '2026-11-13T10:00:00.000Z',
        revokedAt: null,
      },
    },
  };
}

function job(overrides: Partial<SyncQueueJob>): SyncQueueJob {
  return {
    jobId: 'job-1',
    idempotencyKey: 'key-1',
    userId: 'user-1',
    providerId: 'garmin',
    kind: 'route_push',
    targetEntityId: 'route-42',
    revision: 1,
    status: 'queued',
    attempts: 0,
    maxAttempts: 3,
    nextRetryAtMs: null,
    lastError: null,
    createdAtMs: 1_700_000_000_000,
    updatedAtMs: 1_700_000_000_000,
    ...overrides,
  };
}

describe('Connecteurs — modèles d’affichage', () => {
  it('rend un connecteur sans credentials indisponible, sans connexion possible', () => {
    const card = buildConnectorCard(resolveConnectorState('garmin', { env: {} }));

    expect(card.status).toBe('credentials_missing');
    expect(card.statusTone).toBe('warning');
    expect(card.connected).toBe(false);
    expect(card.canStartOAuth).toBe(false);
    expect(card.missingEnvVars).toContain('GARMIN_CLIENT_ID');
    expect(card.credentialHint).toContain('Aucun jeton n’est simulé');
    expect(card.capabilities.every((capability) => capability.state === 'credentials_missing')).toBe(true);
  });

  it('rend un connecteur configuré et autorisé comme connecté et révocable', () => {
    const card = buildConnectorCard(
      resolveConnectorState('garmin', { env: CONFIGURED_ENV, consentSnapshot: grantedSnapshot() })
    );

    expect(card.status).toBe('configured');
    expect(card.connected).toBe(true);
    expect(card.statusLabel).toBe('Connecté');
    expect(card.statusTone).toBe('positive');
    expect(card.revocable).toBe(true);
    expect(card.canStartOAuth).toBe(false);
    expect(card.capabilities.some((capability) => capability.state === 'available')).toBe(true);
  });

  it('rend une révocation explicite et non reconnectable sans action', () => {
    const snapshot = grantedSnapshot();
    const card = buildConnectorCard(
      resolveConnectorState('garmin', {
        env: CONFIGURED_ENV,
        consentSnapshot: {
          ...snapshot,
          providers: {
            garmin: {
              ...snapshot.providers.garmin!,
              connected: false,
              revokedAt: '2026-11-13T11:00:00.000Z',
            },
          },
        },
      })
    );

    expect(card.status).toBe('revoked');
    expect(card.statusLabel).toBe('Connexion révoquée');
    expect(card.connected).toBe(false);
    expect(card.revocable).toBe(false);
    expect(card.canStartOAuth).toBe(true);
  });

  it('groupe les cartes par catégorie dans l’ordre du catalogue', () => {
    const cards = [
      buildConnectorCard(resolveConnectorState('strava', { env: {} })),
      buildConnectorCard(resolveConnectorState('garmin', { env: {} })),
      buildConnectorCard(resolveConnectorState('zwift', { env: {} })),
    ];

    const groups = groupConnectorCards(cards);
    expect(groups.map((group) => group.category)).toEqual(['gps_wearable', 'indoor_platform', 'social_partner']);
    expect(groups[0].connectors.map((card) => card.id)).toEqual(['garmin']);
    expect(summarizeCatalog(cards)).toMatchObject({ total: 3, credentialsMissing: 3, connected: 0 });
  });

  it('résume la file par statut sans compter un job bloqué comme terminé', () => {
    const jobs = [
      buildSyncJobView(job({ jobId: 'a', status: 'queued' }), 'Garmin Connect'),
      buildSyncJobView(job({ jobId: 'b', status: 'completed' }), 'Garmin Connect'),
      buildSyncJobView(job({ jobId: 'c', status: 'blocked_credentials_missing' }), 'Garmin Connect'),
      buildSyncJobView(job({ jobId: 'd', status: 'failed_retryable' }), 'Garmin Connect'),
    ];

    expect(jobs[2].statusLabel).toBe('Bloqué — credentials absents');
    expect(jobs[2].statusTone).toBe('warning');
    expect(summarizeSyncQueue(jobs)).toEqual({
      total: 4,
      pending: 1,
      completed: 1,
      failed: 1,
      blocked: 1,
      cancelled: 0,
    });
  });

  it('ne propose que les partenaires capables d’envoyer un itinéraire', () => {
    const cards = [
      buildConnectorCard(resolveConnectorState('garmin', { env: {} })),
      buildConnectorCard(resolveConnectorState('zwift', { env: {} })),
      buildConnectorCard(resolveConnectorState('strava', { env: {} })),
      buildConnectorCard(resolveConnectorState('samsung_health', { env: {} })),
    ];

    const targets = buildRouteSendTargets(cards);
    expect(targets.map((target) => target.providerId)).toEqual(['garmin', 'samsung_health']);
    expect(targets[0].modeLabel).toContain('Repli manuel');
    expect(targets[0].canSend).toBe(true);
  });
});
