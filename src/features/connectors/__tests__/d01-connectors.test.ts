import { describe, expect, it } from 'vitest';
import {
  buildActivityDeduplicationKey,
  buildGarminUpAheadCoursePayload,
  buildHammerheadCustomPoisPayload,
  buildMultiBrandRouteSyncPlan,
  buildOAuthAuthorizationUrl,
  buildRouteGpxFallbackDocument,
  buildRoutePushIdempotencyKey,
  buildWebhookIdempotencyKey,
  computeRetryBackoffMs,
  computeWebhookSignatureHmac,
  createPkceChallengePair,
  evaluateActivityDeduplication,
  evaluateBrandSyncDirections,
  evaluateConnectorConsent,
  evaluateGarminConnectIqAccess,
  evaluateStravaActivityVisibility,
  exchangeOAuthCodeFailClosed,
  IdempotentConnectorSyncEngine,
  inspectProviderCredentials,
  listPartnerConnectors,
  LiveSyncSessionController,
  mapWaypointToGarminCoursePointType,
  mapWaypointToHammerheadPoiType,
  normalizeIndoorPlatformActivity,
  resolveConnectorState,
  revokePartnerConnection,
  type ActivityProvenanceRecord,
  type CanonicalRouteForSync,
  type ConnectorConsentSnapshot,
  type ConnectorEnvReader,
} from '../index';

const CONFIGURED_ENV: ConnectorEnvReader = {
  GARMIN_CLIENT_ID: 'garmin_cid_real_test',
  GARMIN_CLIENT_SECRET: 'garmin_csec_real_test',
  GARMIN_WEBHOOK_SECRET: 'garmin_wh_secret_test',
  GARMIN_CONNECT_IQ_APP_ID: 'ciq_lkdv_app_001',
  WAHOO_CLIENT_ID: 'wahoo_cid',
  WAHOO_CLIENT_SECRET: 'wahoo_csec',
  WAHOO_WEBHOOK_SECRET: 'wahoo_wh_sec',
  COROS_CLIENT_ID: 'coros_cid',
  COROS_CLIENT_SECRET: 'coros_csec',
  COROS_WEBHOOK_SECRET: 'coros_wh_sec',
  SUUNTO_CLIENT_ID: 'suunto_cid',
  SUUNTO_CLIENT_SECRET: 'suunto_csec',
  SUUNTO_SUBSCRIPTION_KEY: 'suunto_sub_key',
  POLAR_CLIENT_ID: 'polar_cid',
  POLAR_CLIENT_SECRET: 'polar_csec',
  HAMMERHEAD_CLIENT_ID: 'hh_cid',
  HAMMERHEAD_CLIENT_SECRET: 'hh_csec',
  BOSCH_EBIKE_CLIENT_ID: 'bosch_cid',
  BOSCH_EBIKE_CLIENT_SECRET: 'bosch_csec',
  APPLE_WORKOUTKIT_BRIDGE_ENABLED: 'true',
  SAMSUNG_HEALTH_PARTNER_APP_ID: 'samsung_app_id',
  SAMSUNG_HEALTH_CLIENT_SECRET: 'samsung_secret',
  ZWIFT_CLIENT_ID: 'zwift_cid',
  ZWIFT_CLIENT_SECRET: 'zwift_csec',
  ZWIFT_WEBHOOK_SECRET: 'zwift_wh_sec',
  STRAVA_CLIENT_ID: 'strava_cid',
  STRAVA_CLIENT_SECRET: 'strava_csec',
  STRAVA_WEBHOOK_VERIFY_TOKEN: 'strava_wh_token',
};

function createGrantedSnapshot(userId = 'user_lkdv_1'): ConnectorConsentSnapshot {
  return {
    userId,
    policyVersion: 'a1-v1',
    purposes: {
      personal_performance: true,
      collective_terrain: true,
      live_location: false,
      group_location: false,
      external_readiness: false,
    },
    providers: {
      garmin: {
        providerId: 'garmin',
        connected: true,
        allowedScopes: ['activity_import', 'route_export', 'waypoint_export', 'live_sync'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
      garmin_connect_iq: {
        providerId: 'garmin_connect_iq',
        connected: true,
        allowedScopes: ['route_export', 'connect_iq_map'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
      hammerhead: {
        providerId: 'hammerhead',
        connected: true,
        allowedScopes: ['activity_import', 'route_export', 'waypoint_export'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
      wahoo: {
        providerId: 'wahoo',
        connected: true,
        allowedScopes: ['activity_import', 'route_export', 'waypoint_export', 'live_sync'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
      coros: {
        providerId: 'coros',
        connected: true,
        allowedScopes: ['activity_import', 'route_export', 'waypoint_export'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
      suunto: {
        providerId: 'suunto',
        connected: true,
        allowedScopes: ['activity_import', 'route_export', 'waypoint_export'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
      polar: {
        providerId: 'polar',
        connected: true,
        allowedScopes: ['activity_import', 'route_export', 'waypoint_export'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
      samsung_health: {
        providerId: 'samsung_health',
        connected: true,
        allowedScopes: ['route_export', 'waypoint_export'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
      strava: {
        providerId: 'strava',
        connected: true,
        allowedScopes: ['activity_import'],
        grantedAt: '2026-11-13T08:00:00.000Z',
        revokedAt: null,
      },
    },
  };
}

const SAMPLE_ROUTE: CanonicalRouteForSync = {
  routeId: 'route_chamonix_01',
  revision: 2,
  title: 'Tour des Aiguilles Rouges',
  sportType: 'trail_running',
  totalDistanceMeters: 24500,
  elevationGainMeters: 1650,
  elevationLossMeters: 1650,
  coordinates: [
    [45.9237, 6.8694, 1035],
    [45.9651, 6.8812, 1890],
    [45.981, 6.892, 2350],
  ],
  waypoints: [
    {
      id: 'wp_1',
      name: 'Col des Montets Eau',
      lat: 45.9651,
      lng: 6.8812,
      elevationMeters: 1461,
      distanceFromStartMeters: 4200,
      category: 'water_source',
      description: 'Fontaine potable',
    },
    {
      id: 'wp_2',
      name: 'Passage aérien câblé',
      lat: 45.973,
      lng: 6.885,
      elevationMeters: 2010,
      distanceFromStartMeters: 11800,
      category: 'danger',
      description: 'Échelles métalliques',
    },
    {
      id: 'wp_3',
      name: 'Refuge du Lac Blanc',
      lat: 45.981,
      lng: 6.892,
      elevationMeters: 2352,
      distanceFromStartMeters: 16400,
      category: 'refuge_food',
    },
    {
      id: 'wp_4',
      name: 'Belvédère Aiguille Verte',
      lat: 45.9825,
      lng: 6.895,
      elevationMeters: 2400,
      distanceFromStartMeters: 17100,
      category: 'summit',
    },
  ],
  climbs: [
    {
      id: 'climb_1',
      name: 'Montée du Lac Blanc',
      startDistanceMeters: 4200,
      endDistanceMeters: 16400,
      lengthMeters: 12200,
      elevationGainMeters: 890,
      averageGradePercent: 7.3,
      category: 'cat_1',
    },
  ],
  maneuvers: [
    {
      id: 'm_1',
      distanceFromStartMeters: 8500,
      lat: 45.97,
      lng: 6.883,
      direction: 'sharp_left',
      instruction: 'Prendre à gauche vers les échelles',
    },
  ],
};

describe('D01 — Connecteurs partenaires, OAuth/PKCE, Webhooks idempotents & Synchronisation', () => {
  describe('Registre unifié & Invariant Fail-Closed sans credentials', () => {
    it('marque tous les connecteurs en credentials_missing quand les variables d’environnement sont absentes', () => {
      const emptyEnv: ConnectorEnvReader = {};
      const snapshot = createGrantedSnapshot();

      const allStates = listPartnerConnectors({ env: emptyEnv, consentSnapshot: snapshot });
      expect(allStates.length).toBeGreaterThanOrEqual(15);

      for (const state of allStates) {
        expect(state.status).toBe('credentials_missing');
        expect(state.connected).toBe(false);
        expect(state.missingEnvVars.length).toBeGreaterThan(0);
      }

      const garminCreds = inspectProviderCredentials('garmin', emptyEnv);
      expect(garminCreds.configured).toBe(false);
      expect(garminCreds.missingEnvVars).toEqual([
        'GARMIN_CLIENT_ID',
        'GARMIN_CLIENT_SECRET',
        'GARMIN_WEBHOOK_SECRET',
      ]);
    });

    it('passe en état configured quand les credentials sont présents et expose un état unavailable explicite en cas de panne fournisseur', () => {
      const snapshot = createGrantedSnapshot();
      const configuredGarmin = resolveConnectorState('garmin', {
        env: CONFIGURED_ENV,
        consentSnapshot: snapshot,
      });

      expect(configuredGarmin.status).toBe('configured');
      expect(configuredGarmin.connected).toBe(true);
      expect(configuredGarmin.capabilities.routeExport).toBe('available');
      expect(configuredGarmin.capabilities.activityImport).toBe('available');

      const unavailableGarmin = resolveConnectorState('garmin', {
        env: CONFIGURED_ENV,
        consentSnapshot: snapshot,
        forceServiceUnavailable: true,
      });
      expect(unavailableGarmin.status).toBe('unavailable');
      expect(unavailableGarmin.connected).toBe(false);
      expect(unavailableGarmin.capabilities.routeExport).toBe('error');
    });
  });

  describe('OAuth 2.0 + PKCE S256 & Consentements P01 (S6.16)', () => {
    it('refuse de construire une URL OAuth ou de simuler un token si les credentials manquent', async () => {
      const pkce = createPkceChallengePair(
        'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk_valid_43_chars'
      );
      expect(pkce.codeChallengeMethod).toBe('S256');
      expect(pkce.codeChallenge.length).toBeGreaterThan(20);

      const authMissing = buildOAuthAuthorizationUrl({
        providerId: 'garmin',
        userId: 'user_1',
        redirectUri: 'https://lkdv.app/api/connectors/garmin/callback',
        state: 'csrf_state_123',
        pkce,
        env: {},
      });
      expect(authMissing.ok).toBe(false);
      if (!authMissing.ok) {
        expect(authMissing.status).toBe('credentials_missing');
        expect(authMissing.missingEnvVars).toContain('GARMIN_CLIENT_ID');
      }

      const tokenMissingCreds = await exchangeOAuthCodeFailClosed({
        providerId: 'strava',
        userId: 'user_1',
        code: 'oauth_code_abc',
        codeVerifier: pkce.codeVerifier,
        redirectUri: 'https://lkdv.app/api/connectors/strava/callback',
        env: {},
      });
      expect(tokenMissingCreds.ok).toBe(false);
      if (!tokenMissingCreds.ok) {
        expect(tokenMissingCreds.status).toBe('credentials_missing');
      }

      // Même avec credentials présents, sans transport serveur réel, aucun token simulé n'est inventé
      const tokenMissingTransport = await exchangeOAuthCodeFailClosed({
        providerId: 'strava',
        userId: 'user_1',
        code: 'oauth_code_abc',
        codeVerifier: pkce.codeVerifier,
        redirectUri: 'https://lkdv.app/api/connectors/strava/callback',
        env: CONFIGURED_ENV,
      });
      expect(tokenMissingTransport.ok).toBe(false);
      if (!tokenMissingTransport.ok) {
        expect(tokenMissingTransport.status).toBe('transport_missing');
      }
    });

    it('construit une URL OAuth PKCE valide avec credentials et gère la révocation immédiate (S6.16)', async () => {
      const pkce = createPkceChallengePair();
      const authOk = buildOAuthAuthorizationUrl({
        providerId: 'garmin',
        userId: 'user_1',
        redirectUri: 'https://lkdv.app/api/connectors/garmin/callback',
        state: 'state_999',
        pkce,
        env: CONFIGURED_ENV,
      });

      expect(authOk.ok).toBe(true);
      if (authOk.ok) {
        expect(authOk.authorizationUrl).toContain('client_id=garmin_cid_real_test');
        expect(authOk.authorizationUrl).toContain(`code_challenge=${pkce.codeChallenge}`);
        expect(authOk.authorizationUrl).toContain('code_challenge_method=S256');
      }

      // Vérifie que external_readiness est toujours bloqué en Phase 1 (P01 S6.16)
      const snapshot = createGrantedSnapshot();
      const healthEval = evaluateConnectorConsent(
        snapshot,
        'garmin',
        'health_metrics',
        ['external_readiness']
      );
      expect(healthEval.allowed).toBe(false);
      expect(healthEval.status).toBe('purpose_disabled_phase1');

      // Révocation coupe la connexion et annule les jobs en attente
      const syncEngine = new IdempotentConnectorSyncEngine();
      syncEngine.enqueueOutboundRouteSync({
        userId: snapshot.userId,
        providerId: 'garmin',
        routeId: 'route_1',
        revision: 1,
        kind: 'route_push',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });

      const { updatedSnapshot, result } = await revokePartnerConnection({
        snapshot,
        providerId: 'garmin',
        nowIso: '2026-11-13T12:30:00.000Z',
        env: CONFIGURED_ENV,
        cancelPendingJobsForProvider: (uid, pid) =>
          syncEngine.cancelPendingJobsForProvider(uid, pid),
      });

      expect(result.ok).toBe(true);
      expect(result.newStatus).toBe('revoked');
      expect(result.cancelledPendingJobs).toBe(1);
      expect(updatedSnapshot.providers.garmin?.connected).toBe(false);
      expect(updatedSnapshot.providers.garmin?.revokedAt).toBe('2026-11-13T12:30:00.000Z');

      const postRevokeConsent = evaluateConnectorConsent(
        updatedSnapshot,
        'garmin',
        'route_export'
      );
      expect(postRevokeConsent.allowed).toBe(false);
      expect(postRevokeConsent.status).toBe('provider_revoked');
    });
  });

  describe('Webhooks idempotents, file de synchronisation & conflits de révision', () => {
    it('garantit l’idempotence stricte des webhooks et vérifie la signature HMAC (fail-closed)', () => {
      const engine = new IdempotentConnectorSyncEngine();
      const snapshot = createGrantedSnapshot();
      const rawPayloadHash = 'sha256_payload_act_777';
      const validSig = computeWebhookSignatureHmac(
        CONFIGURED_ENV.GARMIN_WEBHOOK_SECRET!,
        rawPayloadHash
      );

      // 1. Signature invalide -> rejeté
      const badSigRes = engine.ingestWebhookEvent({
        event: {
          providerId: 'garmin',
          deliveryId: 'deliv_001',
          eventType: 'activity.create',
          externalUserId: 'garmin_user_42',
          externalObjectId: 'garmin_act_777',
          occurredAt: '2026-11-13T10:00:00Z',
          signatureHeader: 'invalid_hmac_sig',
          rawPayloadHash,
        },
        userId: snapshot.userId,
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(badSigRes.result.accepted).toBe(false);
      expect(badSigRes.result.status).toBe('rejected_invalid_signature');

      // 2. Premier appel valide -> traité et job créé
      const firstRes = engine.ingestWebhookEvent({
        event: {
          providerId: 'garmin',
          deliveryId: 'deliv_001',
          eventType: 'activity.create',
          externalUserId: 'garmin_user_42',
          externalObjectId: 'garmin_act_777',
          occurredAt: '2026-11-13T10:00:00Z',
          signatureHeader: validSig,
          rawPayloadHash,
        },
        userId: snapshot.userId,
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(firstRes.result.accepted).toBe(true);
      expect(firstRes.result.idempotentReplay).toBe(false);
      expect(firstRes.result.status).toBe('processed');
      expect(firstRes.result.enqueuedJobId).toBe('sync_job_1');

      // 3. Rejeu du même webhook -> ignoré de manière idempotente sans nouveau job
      const replayRes = engine.ingestWebhookEvent({
        event: {
          providerId: 'garmin',
          deliveryId: 'deliv_001',
          eventType: 'activity.create',
          externalUserId: 'garmin_user_42',
          externalObjectId: 'garmin_act_777',
          occurredAt: '2026-11-13T10:00:00Z',
          signatureHeader: validSig,
          rawPayloadHash,
        },
        userId: snapshot.userId,
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(replayRes.result.idempotentReplay).toBe(true);
      expect(replayRes.result.status).toBe('duplicate_ignored');
      expect(replayRes.result.enqueuedJobId).toBeNull();
      expect(engine.listJobsForUser(snapshot.userId)).toHaveLength(1);
    });

    it('déduplique les envois d’itinéraires identiques, supersède les anciennes révisions et applique le backoff', () => {
      const engine = new IdempotentConnectorSyncEngine();
      const snapshot = createGrantedSnapshot();

      const pushV1 = engine.enqueueOutboundRouteSync({
        userId: snapshot.userId,
        providerId: 'garmin',
        routeId: 'route_alp_1',
        revision: 1,
        kind: 'route_push',
        deviceModelId: 'garmin_fenix_8',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
        nowMs: 1_000_000,
      });
      expect(pushV1.job.status).toBe('queued');
      expect(pushV1.deduplicatedReplay).toBe(false);

      // Rejeu exact de v1 -> dédupliqué
      const pushV1Duplicate = engine.enqueueOutboundRouteSync({
        userId: snapshot.userId,
        providerId: 'garmin',
        routeId: 'route_alp_1',
        revision: 1,
        kind: 'route_push',
        deviceModelId: 'garmin_fenix_8',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
        nowMs: 1_005_000,
      });
      expect(pushV1Duplicate.deduplicatedReplay).toBe(true);
      expect(pushV1Duplicate.job.jobId).toBe(pushV1.job.jobId);

      // Envoi d'une révision plus récente v2 -> supersède v1
      const pushV2 = engine.enqueueOutboundRouteSync({
        userId: snapshot.userId,
        providerId: 'garmin',
        routeId: 'route_alp_1',
        revision: 2,
        kind: 'route_push',
        deviceModelId: 'garmin_fenix_8',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
        nowMs: 1_010_000,
      });
      expect(pushV2.supersededJobIds).toEqual([pushV1.job.jobId]);
      expect(pushV1.job.status).toBe('superseded_by_newer_revision');

      // Test backoff exponentiel borné sur échec réseau
      const failedOnce = engine.recordJobAttemptFailure(
        pushV2.job.jobId,
        'Timeout API Garmin',
        1_020_000
      );
      expect(failedOnce?.status).toBe('failed_retryable');
      expect(failedOnce?.nextRetryAtMs).toBe(1_020_000 + computeRetryBackoffMs(1));
    });
  });

  describe('Déduplication multi-sources, anti-boucle & protection contre suppression tardive (K6.06, S6.04)', () => {
    const existingCanonical: ActivityProvenanceRecord = {
      canonicalActivityId: 'lkdv_act_100',
      userId: 'user_lkdv_1',
      primaryProvider: 'garmin',
      linkedSources: [
        {
          providerId: 'garmin',
          externalActivityId: 'garmin_998877',
          importedAt: '2026-11-13T09:00:00Z',
        },
      ],
      originApplication: 'garmin',
      startTimeIso: '2026-11-13T07:30:00Z',
      durationSeconds: 3600,
      distanceMeters: 12000,
      sportType: 'trail_running',
      startLatLng: [45.9237, 6.8694],
      hasGpsRoute: true,
      hasHeartRateSeries: true,
      hasPowerSeries: false,
    };

    it('ignore un doublon exact mais lie et enrichit une activité reçue via une seconde voie (ex: Garmin + Strava)', () => {
      // Doublon exact Garmin sans nouveau flux
      const exactDup = evaluateActivityDeduplication(
        {
          userId: 'user_lkdv_1',
          providerId: 'garmin',
          externalActivityId: 'garmin_998877',
          startTimeIso: '2026-11-13T07:30:00Z',
          durationSeconds: 3600,
          distanceMeters: 12000,
          sportType: 'trail_running',
          startLatLng: [45.9237, 6.8694],
          hasGpsRoute: true,
          hasHeartRateSeries: true,
          hasPowerSeries: false,
        },
        [existingCanonical]
      );
      expect(exactDup.decision).toBe('ignore_exact_duplicate');

      // Même activité arrivant 30 secondes plus tard via Strava avec série de puissance
      const crossChannel = evaluateActivityDeduplication(
        {
          userId: 'user_lkdv_1',
          providerId: 'strava',
          externalActivityId: 'strava_554433',
          startTimeIso: '2026-11-13T07:30:25Z',
          durationSeconds: 3615,
          distanceMeters: 12040,
          sportType: 'trail_running',
          startLatLng: [45.9238, 6.8695],
          hasGpsRoute: true,
          hasHeartRateSeries: true,
          hasPowerSeries: true,
        },
        [existingCanonical]
      );
      expect(crossChannel.decision).toBe('link_and_enrich_existing');
      if (crossChannel.decision === 'link_and_enrich_existing') {
        expect(crossChannel.canonicalActivityId).toBe('lkdv_act_100');
        expect(crossChannel.enrichmentFields).toContain('power_series');
      }
    });

    it('rejette les boucles de synchronisation (LKDV -> Partenaire -> LKDV) et les retours tardifs après suppression locale', () => {
      const loopAttempt = evaluateActivityDeduplication(
        {
          userId: 'user_lkdv_1',
          providerId: 'strava',
          externalActivityId: 'strava_loop_1',
          originApplication: 'lkdv',
          sourceChain: ['lkdv', 'healthkit', 'strava'],
          startTimeIso: '2026-11-13T11:00:00Z',
          durationSeconds: 1800,
          distanceMeters: 5000,
          sportType: 'running',
          hasGpsRoute: true,
          hasHeartRateSeries: false,
          hasPowerSeries: false,
        },
        [existingCanonical]
      );
      expect(loopAttempt.decision).toBe('reject_sync_loop');

      const deletedRecord: ActivityProvenanceRecord = {
        ...existingCanonical,
        deletedLocallyAt: '2026-11-13T10:00:00Z',
      };
      const lateSyncAfterDelete = evaluateActivityDeduplication(
        {
          userId: 'user_lkdv_1',
          providerId: 'garmin',
          externalActivityId: 'garmin_998877',
          startTimeIso: '2026-11-13T07:30:00Z',
          durationSeconds: 3600,
          distanceMeters: 12000,
          sportType: 'trail_running',
          hasGpsRoute: true,
          hasHeartRateSeries: true,
          hasPowerSeries: false,
        },
        [deletedRecord]
      );
      expect(lateSyncAfterDelete.decision).toBe('reject_locally_deleted_tombstone');
    });
  });

  describe('Garmin Connect IQ (K6.07), Up Ahead & Waypoints (K6.08), Hammerhead (K6.13) & Live Sync (K6.12)', () => {
    it('mappe correctement les waypoints et ascensions vers Garmin Up Ahead (K6.08) et gère les modèles non compatibles', () => {
      const snapshot = createGrantedSnapshot();

      expect(mapWaypointToGarminCoursePointType('water_source')).toBe('water');
      expect(mapWaypointToGarminCoursePointType('danger')).toBe('danger');
      expect(mapWaypointToGarminCoursePointType('summit')).toBe('summit');
      expect(mapWaypointToGarminCoursePointType('turn_left')).toBe('left');

      const fenixPayload = buildGarminUpAheadCoursePayload({
        route: SAMPLE_ROUTE,
        deviceModelId: 'garmin_fenix_8',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });

      expect(fenixPayload.deliveryMode).toBe('cloud_api_ready');
      expect(fenixPayload.upAheadSupported).toBe(true);
      expect(fenixPayload.climbProSupported).toBe(true);
      // 4 waypoints + 1 manœuvre = 5 CoursePoints triés par distance
      expect(fenixPayload.upAheadPoints).toHaveLength(5);
      expect(fenixPayload.upAheadPoints[0]?.garminType).toBe('water');
      expect(fenixPayload.upAheadPoints[1]?.garminType).toBe('left'); // manœuvre à 8500m
      expect(fenixPayload.climbSegments).toHaveLength(1);

      // Modèle ancien non compatible Up Ahead (vívoactive 3)
      const legacyPayload = buildGarminUpAheadCoursePayload({
        route: SAMPLE_ROUTE,
        deviceModelId: 'garmin_vivoactive_3_legacy',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(legacyPayload.upAheadSupported).toBe(false);
      expect(legacyPayload.upAheadPoints).toHaveLength(0);
      expect(legacyPayload.deliveryMode).toBe('manual_fit_fallback');
    });

    it('vérifie l’éligibilité Garmin Connect IQ (K6.07) hors navigation principale', () => {
      const snapshot = createGrantedSnapshot();
      const ciqReady = evaluateGarminConnectIqAccess({
        deviceModelId: 'garmin_fenix_8',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(ciqReady.eligible).toBe(true);
      expect(ciqReady.exposeInMainNavigation).toBe(false);
      expect(ciqReady.status).toBe('ready');

      const ciqIncompatible = evaluateGarminConnectIqAccess({
        deviceModelId: 'garmin_vivoactive_3_legacy',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(ciqIncompatible.eligible).toBe(false);
      expect(ciqIncompatible.status).toBe('device_incompatible');
    });

    it('exporte les repères personnalisés Hammerhead (K6.13) sur Karoo 3 et bloque Karoo 1 legacy', () => {
      const snapshot = createGrantedSnapshot();
      expect(mapWaypointToHammerheadPoiType('danger')).toBe('caution');
      expect(mapWaypointToHammerheadPoiType('refuge_food')).toBe('food');

      const karoo3Payload = buildHammerheadCustomPoisPayload({
        route: SAMPLE_ROUTE,
        deviceModelId: 'hammerhead_karoo_3',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(karoo3Payload.compatible).toBe(true);
      expect(karoo3Payload.deliveryMode).toBe('cloud_api_ready');
      expect(karoo3Payload.customPois).toHaveLength(4);
      expect(karoo3Payload.customPois[1]?.hammerheadType).toBe('caution');

      const karoo1Payload = buildHammerheadCustomPoisPayload({
        route: SAMPLE_ROUTE,
        deviceModelId: 'hammerhead_karoo_1_legacy',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(karoo1Payload.compatible).toBe(false);
      expect(karoo1Payload.deliveryMode).toBe('incompatible_device');
      expect(karoo1Payload.customPois).toHaveLength(0);
    });

    it('pilote l’état temporaire Live Sync (K6.12) : visible uniquement pendant transfert ou échec, retiré à la résolution', () => {
      const snapshot = createGrantedSnapshot();
      const controller = new LiveSyncSessionController();

      expect(controller.getBannerViewModel().visible).toBe(false);

      const transferring = controller.startTransfer({
        providerId: 'wahoo',
        deviceModelId: 'wahoo_elemnt_roam_v2',
        routeId: SAMPLE_ROUTE.routeId,
        revision: 3,
        isMidNavigationUpdate: true,
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(transferring.visible).toBe(true);
      expect(transferring.state).toBe('transferring');
      expect(transferring.mainControlsAvailable).toBe(true);

      const failed = controller.markSignalLostOrFailed('Connexion BLE/Cloud interrompue');
      expect(failed.visible).toBe(true);
      expect(failed.state).toBe('failed');
      expect(failed.canRetry).toBe(true);

      const resolved = controller.resolveTransfer();
      expect(resolved.visible).toBe(false);
      expect(resolved.state).toBe('resolved');
      expect(resolved.message).toBeNull();
      expect(resolved.mainControlsAvailable).toBe(true);
    });
  });

  describe('Multi-marques GPS (K6.14, S3.23, S6.04), Plateformes Indoor (S6.05) & Strava API (S6.27)', () => {
    it('distingue envoi de parcours et import d’activité par marque (K6.14/S3.23/S6.04) et produit un GPX de repli', () => {
      const snapshot = createGrantedSnapshot();

      const corosSummary = evaluateBrandSyncDirections({
        providerId: 'coros',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(corosSummary.supportsRoutePush).toBe(true);
      expect(corosSummary.supportsActivityImport).toBe(true);
      expect(corosSummary.routePushStatus).toBe('ready');

      const zwiftSummary = evaluateBrandSyncDirections({
        providerId: 'zwift',
        consentSnapshot: snapshot,
        env: CONFIGURED_ENV,
      });
      expect(zwiftSummary.supportsRoutePush).toBe(false);
      expect(zwiftSummary.supportsActivityImport).toBe(true);
      expect(zwiftSummary.routePushStatus).toBe('unsupported');

      // Plan d'envoi Suunto sans credentials -> repli manuel GPX
      const suuntoFallbackPlan = buildMultiBrandRouteSyncPlan({
        providerId: 'suunto',
        route: SAMPLE_ROUTE,
        deviceModelId: 'suunto_vertical',
        consentSnapshot: snapshot,
        env: {},
      });
      expect(suuntoFallbackPlan.deliveryMode).toBe('manual_file_fallback');
      expect(suuntoFallbackPlan.gpxFallbackXml).toContain('<gpx version="1.1"');
      expect(suuntoFallbackPlan.gpxFallbackXml).toContain('Col des Montets Eau');

      const gpxDoc = buildRouteGpxFallbackDocument(SAMPLE_ROUTE, 2);
      expect(gpxDoc).toContain('<trkpt lat="45.9237" lon="6.8694"><ele>1035</ele></trkpt>');
    });

    it('préserve le type d’effort, les intervalles et les séries indoor (S6.05) sans éligibilité aux segments GPS outdoor', () => {
      const normalizedZwift = normalizeIndoorPlatformActivity({
        providerId: 'zwift',
        externalActivityId: 'zwift_act_888',
        userId: 'user_lkdv_1',
        title: 'Watopia SST Intervals',
        effortType: 'virtual_ride',
        virtualWorldName: 'Watopia',
        startTimeIso: '2026-11-13T18:00:00Z',
        elapsedSeconds: 2700,
        movingSeconds: 2680,
        distanceMeters: 28500,
        elevationGainMeters: 420,
        samples: [
          { elapsedSeconds: 1, powerWatts: 240, cadenceRpm: 90, heartRateBpm: 148 },
          { elapsedSeconds: 2, powerWatts: 260, cadenceRpm: 92, heartRateBpm: 152 },
        ],
        intervals: [
          { label: 'Warmup', durationSeconds: 600, targetPowerWatts: 180 },
          { label: 'SST Block 1', durationSeconds: 900, targetPowerWatts: 250 },
        ],
      });

      expect(normalizedZwift.effortType).toBe('virtual_ride');
      expect(normalizedZwift.availableSeries.power).toBe(true);
      expect(normalizedZwift.availableSeries.resistance).toBe(false);
      expect(normalizedZwift.summaryMetrics.avgPowerWatts).toBe(250);
      expect(normalizedZwift.summaryMetrics.maxPowerWatts).toBe(260);
      expect(normalizedZwift.intervals).toHaveLength(2);
      expect(normalizedZwift.hasRealOutdoorGpsTrace).toBe(false);
      expect(normalizedZwift.eligibleForOutdoorGpsSegments).toBe(false);
    });

    it('applique strictement les règles de visibilité de l’API Strava (S6.27) : propriétaire uniquement, exclu des flux tiers/publics/IA', () => {
      const snapshot = createGrantedSnapshot('owner_user_42');
      const stravaAct = {
        internalActivityId: 'lkdv_strava_1',
        externalStravaActivityId: 'strava_9001',
        ownerUserId: 'owner_user_42',
        title: 'Sortie matinale Strava',
        sportType: 'road_cycling',
        startTimeIso: '2026-11-13T06:30:00Z',
        distanceMeters: 45000,
        movingTimeSeconds: 5400,
        elevationGainMeters: 620,
        summaryPolyline: 'encoded_poly_xyz',
        connectorRevoked: false,
      };

      // 1. Propriétaire sur son historique privé -> autorisé
      const ownerView = evaluateStravaActivityVisibility({
        activity: stravaAct,
        viewerUserId: 'owner_user_42',
        surface: 'owner_activity_detail',
        consentSnapshot: snapshot,
      });
      expect(ownerView.allowed).toBe(true);
      expect(ownerView.projectedActivity?.externalStravaActivityId).toBe('strava_9001');

      // 2. Autre utilisateur -> refusé
      const otherUserView = evaluateStravaActivityVisibility({
        activity: stravaAct,
        viewerUserId: 'other_user_99',
        surface: 'owner_activity_detail',
        consentSnapshot: snapshot,
      });
      expect(otherUserView.allowed).toBe(false);
      expect(otherUserView.reason).toBe('strava_api_visibility_restricted_non_owner');

      // 3. Fil public, heatmap communautaire ou classement segment -> refusé même pour le propriétaire
      const publicFeedView = evaluateStravaActivityVisibility({
        activity: stravaAct,
        viewerUserId: 'owner_user_42',
        surface: 'public_community_feed',
        consentSnapshot: snapshot,
      });
      expect(publicFeedView.allowed).toBe(false);
      expect(publicFeedView.reason).toBe('strava_api_prohibits_public_feed_or_heatmap');

      // 4. Usage IA ou agrégat -> refusé
      const aiView = evaluateStravaActivityVisibility({
        activity: stravaAct,
        viewerUserId: 'owner_user_42',
        surface: 'ai_model_training_or_coaching',
        consentSnapshot: snapshot,
      });
      expect(aiView.allowed).toBe(false);
      expect(aiView.reason).toBe('strava_api_prohibits_ai_or_aggregation');

      // 5. Après révocation du connecteur Strava -> refusé partout
      const revokedView = evaluateStravaActivityVisibility({
        activity: { ...stravaAct, connectorRevoked: true },
        viewerUserId: 'owner_user_42',
        surface: 'owner_private_history',
        consentSnapshot: snapshot,
      });
      expect(revokedView.allowed).toBe(false);
      expect(revokedView.reason).toBe('revoked_or_deauthorized');

      // Vérifie les clés déterministes exportées
      expect(buildActivityDeduplicationKey('u1', 'strava', '9001')).toBe('activity:u1:strava:9001');
      expect(
        buildRoutePushIdempotencyKey({
          userId: 'u1',
          providerId: 'garmin',
          routeId: 'r1',
          revision: 3,
          kind: 'route_push',
        })
      ).toBe('sync:route_push:u1:garmin:r1:v3');
      expect(
        buildWebhookIdempotencyKey({
          providerId: 'strava',
          deliveryId: 'd99',
          eventType: 'activity.create',
          externalUserId: 'ath1',
          externalObjectId: 'act1',
          occurredAt: '2026-11-13T00:00:00Z',
          rawPayloadHash: 'h1',
        })
      ).toBe('webhook:strava:delivery:d99');
    });
  });
});
