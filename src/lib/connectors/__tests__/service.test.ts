import { createHash } from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  computeWebhookSignatureHmac,
  type CanonicalRouteForSync,
  type ConnectorEnvReader,
  type OAuthTransportAdapter,
} from '@/features/connectors';
import {
  beginConnectorOAuth,
  completeConnectorOAuth,
  getConnectorCatalog,
  getConnectorSyncQueue,
  ingestPartnerWebhook,
  revokeConnector,
  sendRouteToConnector,
} from '../service';
import { getConnectorSession, resetConnectorStoreForTests } from '../serverStore';

const USER_ID = 'user-d01-ui';

const GARMIN_ENV: ConnectorEnvReader = {
  GARMIN_CLIENT_ID: 'garmin_client_id',
  GARMIN_CLIENT_SECRET: 'garmin_client_secret',
  GARMIN_WEBHOOK_SECRET: 'garmin_webhook_secret',
};

const fakeTransport: OAuthTransportAdapter = async () => ({
  accessToken: 'token-not-persisted',
  refreshToken: 'refresh-not-persisted',
  expiresInSeconds: 3600,
  externalAthleteId: 'athlete-42',
  grantedScopes: ['activities:read', 'courses:write'],
});

const route: CanonicalRouteForSync = {
  routeId: 'gr20-sud',
  revision: 3,
  title: 'GR20 sud — Vizzavona à Conca',
  sportType: 'hiking',
  totalDistanceMeters: 54_000,
  elevationGainMeters: 3_200,
  elevationLossMeters: 3_400,
  coordinates: [
    [42.1, 9.1, 900],
    [42.11, 9.12, 950],
  ],
  waypoints: [
    {
      id: 'wp-1',
      name: 'Col de Bavella',
      lat: 41.8,
      lng: 9.2,
      elevationMeters: 1_218,
      distanceFromStartMeters: 12_000,
      category: 'col_pass',
    },
  ],
};

beforeEach(() => {
  resetConnectorStoreForTests();
});

async function connectGarmin(): Promise<void> {
  const started = beginConnectorOAuth({
    userId: USER_ID,
    providerId: 'garmin',
    origin: 'https://lkdv.app',
    env: GARMIN_ENV,
  });
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error('OAuth non démarré');

  const completed = await completeConnectorOAuth({
    providerId: 'garmin',
    state: started.response.state,
    code: 'code-1',
    userId: USER_ID,
    env: GARMIN_ENV,
    transport: fakeTransport,
  });
  expect(completed.ok).toBe(true);
}

function grantPersonalPerformance(): void {
  const session = getConnectorSession(USER_ID);
  session.snapshot = {
    ...session.snapshot,
    purposes: { ...session.snapshot.purposes, personal_performance: true },
  };
}

describe('Connecteurs — service serveur D01-UI', () => {
  it('reste fail-closed : aucun démarrage OAuth sans credentials', () => {
    const started = beginConnectorOAuth({
      userId: USER_ID,
      providerId: 'garmin',
      origin: 'https://lkdv.app',
      env: {},
    });

    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.failure.status).toBe('credentials_missing');
    expect(started.failure.missingEnvVars).toContain('GARMIN_CLIENT_ID');

    const catalog = getConnectorCatalog(USER_ID, { env: {} });
    const garmin = catalog.connectors.find((connector) => connector.id === 'garmin');
    expect(garmin?.status).toBe('credentials_missing');
    expect(garmin?.canStartOAuth).toBe(false);
  });

  it('construit une URL OAuth PKCE réelle et lie l’athlète externe', async () => {
    const started = beginConnectorOAuth({
      userId: USER_ID,
      providerId: 'garmin',
      origin: 'https://lkdv.app',
      env: GARMIN_ENV,
      returnTo: '/compte/connecteurs',
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const url = new URL(started.response.authorizationUrl);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe(started.response.state);
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://lkdv.app/api/connectors/oauth/garmin/callback'
    );

    const completed = await completeConnectorOAuth({
      providerId: 'garmin',
      state: started.response.state,
      code: 'code-1',
      userId: USER_ID,
      env: GARMIN_ENV,
      transport: fakeTransport,
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    const garmin = completed.catalog.connectors.find((connector) => connector.id === 'garmin');
    expect(garmin?.oauthLinked).toBe(true);
    expect(garmin?.connected).toBe(false);
    expect(garmin?.statusLabel).toBe('Lié — consentement requis');

    // L'état OAuth est à usage unique : un rejeu est refusé.
    const replay = await completeConnectorOAuth({
      providerId: 'garmin',
      state: started.response.state,
      code: 'code-1',
      userId: USER_ID,
      env: GARMIN_ENV,
      transport: fakeTransport,
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.status).toBe('unknown_state');
  });

  it('refuse un callback pour une autre session', async () => {
    const started = beginConnectorOAuth({
      userId: USER_ID,
      providerId: 'garmin',
      origin: 'https://lkdv.app',
      env: GARMIN_ENV,
    });
    if (!started.ok) throw new Error('OAuth non démarré');

    const hijack = await completeConnectorOAuth({
      providerId: 'garmin',
      state: started.response.state,
      code: 'code-1',
      userId: 'other-user',
      env: GARMIN_ENV,
      transport: fakeTransport,
    });
    expect(hijack.ok).toBe(false);
    if (!hijack.ok) expect(hijack.status).toBe('user_mismatch');
  });

  it('bloque l’envoi sans consentement puis prépare le cloud après autorisation', async () => {
    await connectGarmin();

    const blocked = sendRouteToConnector({
      userId: USER_ID,
      providerId: 'garmin',
      route,
      env: GARMIN_ENV,
    });
    expect(blocked.plan.deliveryMode).toBe('blocked_consent');
    expect(blocked.plan.jobStatus).toBe('blocked_consent_revoked');
    expect(blocked.plan.gpxFallbackXml).toContain('<gpx');

    grantPersonalPerformance();
    const ready = sendRouteToConnector({
      userId: USER_ID,
      providerId: 'garmin',
      route,
      deviceModelId: 'garmin_fenix_8',
      env: GARMIN_ENV,
    });

    expect(ready.plan.deliveryMode).toBe('cloud_push_ready');
    expect(ready.plan.jobStatus).toBe('queued');
    expect(ready.plan.exportedWaypointsCount).toBe(1);
    expect(ready.plan.gpxFallbackXml).toContain('<wpt');
    expect(ready.garminCourse).toMatchObject({ deliveryMode: 'cloud_api_ready' });
  });

  it('révoque, coupe les envois et annule les jobs en attente', async () => {
    await connectGarmin();
    grantPersonalPerformance();
    const sent = sendRouteToConnector({
      userId: USER_ID,
      providerId: 'garmin',
      route,
      env: GARMIN_ENV,
    });
    expect(sent.plan.jobId).toBeTruthy();

    const revoked = await revokeConnector({ userId: USER_ID, providerId: 'garmin', env: GARMIN_ENV });
    expect(revoked.cancelledPendingJobs).toBe(1);
    expect(revoked.purgedTokenReferences).toBe(true);

    const garmin = revoked.catalog.connectors.find((connector) => connector.id === 'garmin');
    expect(garmin?.status).toBe('revoked');

    const after = sendRouteToConnector({
      userId: USER_ID,
      providerId: 'garmin',
      route,
      env: GARMIN_ENV,
    });
    expect(after.plan.deliveryMode).toBe('blocked_consent');

    const queue = getConnectorSyncQueue(USER_ID);
    expect(queue.jobs.some((job) => job.status === 'cancelled')).toBe(true);
  });

  it('ingère un webhook signé, ignore le rejeu et rejette une signature invalide', async () => {
    await connectGarmin();
    grantPersonalPerformance();

    const rawBody = JSON.stringify({
      deliveryId: 'delivery-1',
      eventType: 'activity.create',
      externalUserId: 'athlete-42',
      externalObjectId: 'activity-99',
      occurredAt: '2026-11-13T12:00:00.000Z',
    });
    const hash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
    const signature = computeWebhookSignatureHmac(GARMIN_ENV.GARMIN_WEBHOOK_SECRET!, hash);

    const first = ingestPartnerWebhook({
      providerId: 'garmin',
      rawBody,
      signature,
      env: GARMIN_ENV,
    });
    expect(first.httpStatus).toBe(200);
    expect(first.body.accepted).toBe(true);
    expect(first.body.status).toBe('processed');

    const replay = ingestPartnerWebhook({
      providerId: 'garmin',
      rawBody,
      signature,
      env: GARMIN_ENV,
    });
    expect(replay.body.idempotentReplay).toBe(true);
    expect(replay.body.status).toBe('duplicate_ignored');

    const bad = ingestPartnerWebhook({
      providerId: 'garmin',
      rawBody,
      signature: 'deadbeef',
      env: GARMIN_ENV,
    });
    expect(bad.httpStatus).toBe(401);
    expect(bad.body.accepted).toBe(false);
  });
});
