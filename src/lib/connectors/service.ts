import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import {
  buildGarminUpAheadCoursePayload,
  buildHammerheadCustomPoisPayload,
  buildMultiBrandRouteSyncPlan,
  buildOAuthAuthorizationUrl,
  buildRouteGpxFallbackDocument,
  createPkceChallengePair,
  evaluateConnectorConsent,
  exchangeOAuthCodeFailClosed,
  getDeviceModelProfile,
  inspectProviderCredentials,
  computeWebhookSignatureHmac,
  PARTNER_CONNECTOR_DEFINITIONS,
  resolveConnectorState,
  revokePartnerConnection,
  type CanonicalRouteForSync,
  type ConnectorConsentSnapshot,
  type ConnectorEnvReader,
  type ManualFallbackFormat,
  type OAuthTransportAdapter,
  type PartnerProviderId,
  type SyncJobStatus,
  type SyncQueueJob,
} from '@/features/connectors';
import { fetchOAuthTransport } from './oauthTransport';
import {
  consumePendingOAuthState,
  findUserIdByExternalAthlete,
  getConnectorSession,
  linkExternalAthlete,
  savePendingOAuthState,
} from './serverStore';
import { buildConnectorCard, buildRouteSendTargets, buildSyncJobView, groupConnectorCards, providerLabel, summarizeCatalog, summarizeSyncQueue } from './viewModels';
import type {
  ConnectorCatalogResponse,
  ConnectorSyncQueueResponse,
  OAuthCompleteServiceResult,
  OAuthStartServiceResult,
  RevokeServiceResult,
  RouteDeliveryPlanView,
  RouteSendResponse,
  RouteSendTargetView,
} from './types';

const MULTI_BRAND_PROVIDERS = new Set<PartnerProviderId>([
  'garmin',
  'coros',
  'polar',
  'suunto',
  'wahoo',
  'samsung_health',
]);

function resolveEnv(env?: ConnectorEnvReader): ConnectorEnvReader {
  return env ?? (typeof process !== 'undefined' ? process.env : {});
}

function safeReturnTo(value: string | undefined): string {
  if (!value) return '/compte/connecteurs';
  if (!value.startsWith('/') || value.startsWith('//')) return '/compte/connecteurs';
  return value;
}

export function buildConnectorCatalog(
  userId: string,
  options?: { env?: ConnectorEnvReader; nowIso?: string }
): ConnectorCatalogResponse {
  const session = getConnectorSession(userId);
  const env = resolveEnv(options?.env);
  const cards = (Object.keys(PARTNER_CONNECTOR_DEFINITIONS) as PartnerProviderId[]).map((providerId) => {
    const grant = session.snapshot.providers[providerId];
    const oauthLinked = Boolean(grant?.connected && !grant.revokedAt);
    const grantedPurposes = (Object.keys(session.snapshot.purposes) as Array<keyof typeof session.snapshot.purposes>).filter(
      (purpose) => session.snapshot.purposes[purpose] === true
    );
    return buildConnectorCard(
      resolveConnectorState(providerId, {
        env,
        consentSnapshot: session.snapshot,
        lastSyncedAt: session.lastSyncedAt[providerId] ?? null,
      }),
      { oauthLinked, grantedPurposes }
    );
  });

  return {
    generatedAt: options?.nowIso ?? new Date().toISOString(),
    policyVersion: session.snapshot.policyVersion,
    connectors: cards,
    groups: groupConnectorCards(cards),
    summary: summarizeCatalog(cards),
  };
}

export function getConnectorCatalog(userId: string, options?: { env?: ConnectorEnvReader }): ConnectorCatalogResponse {
  return buildConnectorCatalog(userId, options);
}

export function getConnectorSendTargets(userId: string, options?: { env?: ConnectorEnvReader }): RouteSendTargetView[] {
  return buildRouteSendTargets(
    getConnectorCatalog(userId, options).connectors
  );
}

/**
 * Démarre OAuth 2.0 + PKCE. Fail-closed : sans credentials, aucune URL ni
 * client_id factice n'est renvoyée. L'état PKCE est à usage unique (10 min).
 */
export function beginConnectorOAuth(params: {
  userId: string;
  providerId: PartnerProviderId;
  origin: string;
  returnTo?: string;
  env?: ConnectorEnvReader;
  nowMs?: number;
}): OAuthStartServiceResult {
  const env = resolveEnv(params.env);
  const session = getConnectorSession(params.userId);
  const current = resolveConnectorState(params.providerId, {
    env,
    consentSnapshot: session.snapshot,
  });

  if (current.connected) {
    return {
      ok: false,
      failure: {
        status: 'conflict',
        error: `${current.definition.label} est déjà connecté. Révoque la connexion avant d'en démarrer une nouvelle.`,
        missingEnvVars: [],
      },
    };
  }

  const state = randomBytes(24).toString('base64url');
  const pkce = createPkceChallengePair();
  const redirectUri = `${params.origin.replace(/\/$/, '')}/api/connectors/oauth/${params.providerId}/callback`;

  const authorization = buildOAuthAuthorizationUrl({
    providerId: params.providerId,
    userId: params.userId,
    redirectUri,
    state,
    pkce,
    env,
  });

  if (!authorization.ok) {
    const status =
      authorization.status === 'credentials_missing'
        ? 'credentials_missing'
        : authorization.status === 'invalid_request'
          ? 'invalid_request'
          : 'unavailable';
    return {
      ok: false,
      failure: {
        status,
        error: authorization.error,
        missingEnvVars: authorization.missingEnvVars,
      },
    };
  }

  savePendingOAuthState({
    state,
    userId: params.userId,
    providerId: params.providerId,
    codeVerifier: pkce.codeVerifier,
    redirectUri,
    returnTo: safeReturnTo(params.returnTo),
    createdAtMs: params.nowMs ?? Date.now(),
  });

  return {
    ok: true,
    response: {
      authorizationUrl: authorization.authorizationUrl,
      state,
      providerId: params.providerId,
    },
  };
}

/**
 * Termine OAuth, enregistre la liaison et les usages autorisés.
 * Aucune finalité RGPD n'est accordée implicitement par OAuth.
 */
export async function completeConnectorOAuth(params: {
  providerId: PartnerProviderId;
  state: string;
  code: string | null;
  userId?: string;
  env?: ConnectorEnvReader;
  transport?: OAuthTransportAdapter;
  nowMs?: number;
}): Promise<OAuthCompleteServiceResult> {
  const nowMs = params.nowMs ?? Date.now();
  const consumed = consumePendingOAuthState(params.state, nowMs);
  if (!consumed.ok) {
    return {
      ok: false,
      providerId: params.providerId,
      status: consumed.reason === 'expired' ? 'expired_state' : 'unknown_state',
      error:
        consumed.reason === 'expired'
          ? 'État OAuth expiré (10 minutes) : relance la connexion depuis le compte.'
          : 'État OAuth inconnu ou déjà consommé : relance la connexion.',
    };
  }

  const pending = consumed.pending;
  if (pending.providerId !== params.providerId) {
    return {
      ok: false,
      providerId: params.providerId,
      status: 'provider_mismatch',
      error: 'Le fournisseur du callback ne correspond pas à l’état OAuth signé.',
    };
  }

  if (params.userId && pending.userId !== params.userId) {
    return {
      ok: false,
      providerId: params.providerId,
      status: 'user_mismatch',
      error: 'Cet état OAuth appartient à une autre session : connexion refusée.',
    };
  }

  if (!params.code) {
    return {
      ok: false,
      providerId: params.providerId,
      status: 'invalid_grant',
      error: 'Code d’autorisation absent : aucune connexion établie.',
    };
  }

  const exchange = await exchangeOAuthCodeFailClosed({
    providerId: params.providerId,
    userId: pending.userId,
    code: params.code,
    codeVerifier: pending.codeVerifier,
    redirectUri: pending.redirectUri,
    env: resolveEnv(params.env),
    transport: params.transport ?? fetchOAuthTransport,
    nowMs,
  });

  if (!exchange.ok) {
    return {
      ok: false,
      providerId: params.providerId,
      status:
        exchange.status === 'credentials_missing'
          ? 'credentials_missing'
          : exchange.status === 'transport_missing'
            ? 'transport_missing'
            : exchange.status === 'invalid_grant'
              ? 'invalid_grant'
              : exchange.status === 'transport_error'
                ? 'transport_error'
                : 'unavailable',
      error: exchange.error,
    };
  }

  const def = PARTNER_CONNECTOR_DEFINITIONS[params.providerId];
  const session = getConnectorSession(pending.userId);
  const grantedAt = new Date(nowMs).toISOString();
  const allowedScopes = def.supportedUsages.filter((usage) => usage !== 'health_metrics');

  session.snapshot = {
    ...session.snapshot,
    providers: {
      ...session.snapshot.providers,
      [params.providerId]: {
        providerId: params.providerId,
        connected: true,
        allowedScopes,
        grantedAt,
        revokedAt: null,
      },
    },
  };
  linkExternalAthlete(params.providerId, exchange.externalAthleteId, pending.userId);

  return {
    ok: true,
    providerId: params.providerId,
    redirectTo: pending.returnTo,
    catalog: buildConnectorCatalog(pending.userId, { env: resolveEnv(params.env) }),
  };
}

/**
 * Révocation locale immédiate. La collecte et les envois sont coupés même si
 * l'appel distant échoue ou si les credentials manquent.
 */
export async function revokeConnector(params: {
  userId: string;
  providerId: PartnerProviderId;
  env?: ConnectorEnvReader;
  nowIso?: string;
  nowMs?: number;
  remoteRevokeTransport?: (providerId: PartnerProviderId, revokeUrl: string) => Promise<void>;
}): Promise<RevokeServiceResult> {
  const session = getConnectorSession(params.userId);
  const nowMs = params.nowMs ?? Date.now();
  const { result, updatedSnapshot } = await revokePartnerConnection({
    snapshot: session.snapshot,
    providerId: params.providerId,
    nowIso: params.nowIso ?? new Date(nowMs).toISOString(),
    env: resolveEnv(params.env),
    cancelPendingJobsForProvider: (userId, providerId) =>
      session.engine.cancelPendingJobsForProvider(userId, providerId, nowMs),
    remoteRevokeTransport: params.remoteRevokeTransport,
  });
  session.snapshot = updatedSnapshot;

  return {
    ...result,
    catalog: buildConnectorCatalog(params.userId, { env: resolveEnv(params.env) }),
  };
}

export function getConnectorSyncQueue(userId: string, options?: { nowIso?: string }): ConnectorSyncQueueResponse {
  const session = getConnectorSession(userId);
  const jobs = session.engine
    .listJobsForUser(userId)
    .map((job) => buildSyncJobView(job, providerLabel(job.providerId)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    generatedAt: options?.nowIso ?? new Date().toISOString(),
    jobs,
    summary: summarizeSyncQueue(jobs),
  };
}

interface GenericRoutePlan {
  deliveryMode: RouteDeliveryPlanView['deliveryMode'];
  exportedWaypointsCount: number;
  truncatedWaypointsCount: number;
  fallbackFormat: ManualFallbackFormat;
  gpxFallbackXml: string;
  reason: string;
}

function buildGenericRoutePlan(params: {
  providerId: PartnerProviderId;
  route: CanonicalRouteForSync;
  deviceModelId?: string;
  consentSnapshot: ConnectorConsentSnapshot;
  env: ConnectorEnvReader;
}): GenericRoutePlan {
  const def = PARTNER_CONNECTOR_DEFINITIONS[params.providerId];
  const fallbackFormat = def.staticCapabilities.manualFallbackFormats[0] ?? 'gpx';
  const model = params.deviceModelId ? getDeviceModelProfile(params.deviceModelId) : null;

  if (model && (!model.compatible || !model.supportsRouteImport)) {
    return {
      deliveryMode: 'incompatible_device',
      exportedWaypointsCount: 0,
      truncatedWaypointsCount: params.route.waypoints.length,
      fallbackFormat,
      gpxFallbackXml: buildRouteGpxFallbackDocument(params.route, 0),
      reason: `Le modèle ${model.modelName} ne prend pas en charge l’import d’itinéraire.`,
    };
  }

  const maxWaypoints = model
    ? model.supportsWaypoints
      ? model.maxWaypointsPerRoute
      : 0
    : 100;
  const exportedWaypointsCount = Math.min(params.route.waypoints.length, maxWaypoints);
  const truncatedWaypointsCount = Math.max(0, params.route.waypoints.length - exportedWaypointsCount);
  const gpxFallbackXml = buildRouteGpxFallbackDocument(params.route, exportedWaypointsCount);
  const consent = evaluateConnectorConsent(
    params.consentSnapshot,
    params.providerId,
    'route_export'
  );

  if (!consent.allowed) {
    return {
      deliveryMode: 'blocked_consent',
      exportedWaypointsCount,
      truncatedWaypointsCount,
      fallbackFormat,
      gpxFallbackXml,
      reason: consent.reason,
    };
  }

  const { configured, missingEnvVars } = inspectProviderCredentials(params.providerId, params.env);
  if (!configured) {
    return {
      deliveryMode: 'manual_file_fallback',
      exportedWaypointsCount,
      truncatedWaypointsCount,
      fallbackFormat,
      gpxFallbackXml,
      reason: `Credentials ${def.label} absents (${missingEnvVars.join(', ')}). Repli ${fallbackFormat.toUpperCase()} manuel prêt.`,
    };
  }

  return {
    deliveryMode: 'cloud_push_ready',
    exportedWaypointsCount,
    truncatedWaypointsCount,
    fallbackFormat,
    gpxFallbackXml,
    reason: `Itinéraire et ${exportedWaypointsCount} waypoint(s) prêts pour ${def.label}.`,
  };
}

function jobStatusLabel(status: SyncJobStatus | null): string | null {
  if (!status) return null;
  return (
    {
      queued: 'En attente',
      in_progress: 'En cours',
      completed: 'Terminé',
      failed_retryable: 'Échec — nouvelle tentative prévue',
      failed_terminal: 'Échec définitif',
      blocked_credentials_missing: 'Bloqué — credentials absents',
      blocked_consent_revoked: 'Bloqué — consentement manquant',
      superseded_by_newer_revision: 'Remplacé par une révision plus récente',
      cancelled: 'Annulé',
    } satisfies Record<SyncJobStatus, string>
  )[status];
}

function planDeliveryLabel(
  mode: RouteDeliveryPlanView['deliveryMode'],
  fallbackFormat: ManualFallbackFormat
): string {
  switch (mode) {
    case 'cloud_push_ready':
      return 'Envoi cloud prêt';
    case 'manual_file_fallback':
      return `Repli manuel ${fallbackFormat.toUpperCase()}`;
    case 'blocked_consent':
      return 'Bloqué — consentement requis';
    case 'incompatible_device':
      return 'Appareil incompatible';
  }
}

/**
 * Prépare et met en file l'envoi d'un itinéraire vers un GPS/une montre.
 * Le calcul amont décide du mode ; cette couche ne promeut jamais un repli en
 * envoi cloud et ne contacte aucun partenaire elle-même.
 */
export function sendRouteToConnector(params: {
  userId: string;
  providerId: PartnerProviderId;
  route: CanonicalRouteForSync;
  deviceModelId?: string;
  env?: ConnectorEnvReader;
  nowMs?: number;
}): RouteSendResponse {
  const env = resolveEnv(params.env);
  const session = getConnectorSession(params.userId);
  const def = PARTNER_CONNECTOR_DEFINITIONS[params.providerId];
  const nowMs = params.nowMs ?? Date.now();

  let plan: GenericRoutePlan;
  if (MULTI_BRAND_PROVIDERS.has(params.providerId)) {
    plan = buildMultiBrandRouteSyncPlan({
      providerId: params.providerId as 'garmin' | 'coros' | 'polar' | 'suunto' | 'wahoo' | 'samsung_health',
      route: params.route,
      deviceModelId: params.deviceModelId,
      consentSnapshot: session.snapshot,
      env,
    });
  } else {
    plan = buildGenericRoutePlan({
      providerId: params.providerId,
      route: params.route,
      deviceModelId: params.deviceModelId,
      consentSnapshot: session.snapshot,
      env,
    });
  }

  const garminCourse =
    params.providerId === 'garmin'
      ? buildGarminUpAheadCoursePayload({
          route: params.route,
          deviceModelId: params.deviceModelId,
          consentSnapshot: session.snapshot,
          env,
        })
      : null;

  const hammerheadPois =
    params.providerId === 'hammerhead'
      ? buildHammerheadCustomPoisPayload({
          route: params.route,
          deviceModelId: params.deviceModelId,
          consentSnapshot: session.snapshot,
          env,
        })
      : null;

  // Le payload spécialisé peut exiger un consentement supplémentaire
  // (waypoint_export pour Garmin, repères pour Hammerhead) : on ne surpromet pas.
  if (garminCourse && garminCourse.deliveryMode === 'manual_fit_fallback' && plan.deliveryMode === 'cloud_push_ready') {
    plan = { ...plan, deliveryMode: 'manual_file_fallback', reason: garminCourse.statusReason };
  }
  if (hammerheadPois && hammerheadPois.deliveryMode !== 'cloud_api_ready' && plan.deliveryMode === 'cloud_push_ready') {
    plan = {
      ...plan,
      deliveryMode: hammerheadPois.deliveryMode === 'incompatible_device' ? 'incompatible_device' : 'manual_file_fallback',
      reason: hammerheadPois.statusReason,
    };
  }
  if (hammerheadPois) {
    plan = {
      ...plan,
      exportedWaypointsCount: hammerheadPois.customPois.length,
      truncatedWaypointsCount: hammerheadPois.truncatedPoiCount,
    };
  }

  let job: SyncQueueJob | null = null;
  if (plan.deliveryMode !== 'incompatible_device') {
    const queued = session.engine.enqueueOutboundRouteSync({
      userId: params.userId,
      providerId: params.providerId,
      routeId: params.route.routeId,
      revision: params.route.revision,
      kind: 'route_push',
      deviceModelId: params.deviceModelId,
      consentSnapshot: session.snapshot,
      env,
      nowMs,
    });
    job = queued.job;
  }

  return {
    plan: {
      providerId: params.providerId,
      providerLabel: def.label,
      routeId: params.route.routeId,
      revision: params.route.revision,
      deliveryMode: plan.deliveryMode,
      deliveryLabel: planDeliveryLabel(plan.deliveryMode, plan.fallbackFormat),
      exportedWaypointsCount: plan.exportedWaypointsCount,
      truncatedWaypointsCount: plan.truncatedWaypointsCount,
      fallbackFormat: plan.fallbackFormat,
      reason: plan.reason,
      gpxFallbackXml: plan.gpxFallbackXml,
      jobId: job?.jobId ?? null,
      jobStatus: job?.status ?? null,
      jobStatusLabel: jobStatusLabel(job?.status ?? null),
    },
    garminCourse,
    hammerheadPois,
  };
}

export interface WebhookIngestionServiceResult {
  httpStatus: number;
  body: {
    accepted: boolean;
    idempotentReplay?: boolean;
    status: string;
    reason: string;
    enqueuedJobId?: string | null;
  };
}

/**
 * Ingestion webhook partenaire : signature HMAC, idempotence et révocation.
 * L'utilisateur interne n'est jamais accepté depuis le corps : il vient de la
 * liaison OAuth enregistrée (index athlète externe → utilisateur LKDV).
 */
export function ingestPartnerWebhook(params: {
  providerId: PartnerProviderId;
  rawBody: string;
  signature: string | null;
  env?: ConnectorEnvReader;
  nowMs?: number;
}): WebhookIngestionServiceResult {
  const env = resolveEnv(params.env);
  const def = PARTNER_CONNECTOR_DEFINITIONS[params.providerId];
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(params.rawBody) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { httpStatus: 400, body: { accepted: false, status: 'invalid_payload', reason: 'Corps webhook JSON objet requis.' } };
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return { httpStatus: 400, body: { accepted: false, status: 'invalid_payload', reason: 'Corps webhook JSON invalide.' } };
  }

  const rawPayloadHash = createHash('sha256').update(params.rawBody, 'utf8').digest('hex');

  // La signature est vérifiée avant l'idempotence : un rejeu mal signé ne doit
  // jamais être acquitté comme « doublon ignoré ».
  if (def.webhookSecretEnvVar) {
    const secret = (env[def.webhookSecretEnvVar] ?? '').trim();
    if (secret) {
      const expectedSignature = computeWebhookSignatureHmac(secret, rawPayloadHash);
      const provided = params.signature ?? '';
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const providedBuffer = Buffer.from(provided, 'utf8');
      const valid =
        expectedBuffer.length === providedBuffer.length &&
        timingSafeEqual(expectedBuffer, providedBuffer);
      if (!valid) {
        return {
          httpStatus: 401,
          body: {
            accepted: false,
            status: 'rejected_invalid_signature',
            reason: `Signature HMAC du webhook ${def.label} absente ou invalide.`,
          },
        };
      }
    }
  }

  const externalUserId = typeof payload.externalUserId === 'string' ? payload.externalUserId : '';
  const userId = externalUserId
    ? findUserIdByExternalAthlete(params.providerId, externalUserId)
    : null;

  if (!userId) {
    return {
      httpStatus: 202,
      body: {
        accepted: false,
        status: 'unknown_athlete',
        reason: `Aucune liaison ${def.label} connue pour cet athlète : événement ignoré sans création de job.`,
      },
    };
  }

  const session = getConnectorSession(userId);

  const { result, updatedConsentSnapshot } = session.engine.ingestWebhookEvent({
    event: {
      providerId: params.providerId,
      deliveryId:
        typeof payload.deliveryId === 'string' && payload.deliveryId.trim()
          ? payload.deliveryId
          : rawPayloadHash,
      eventType:
        payload.eventType === 'activity.update' ||
        payload.eventType === 'activity.delete' ||
        payload.eventType === 'route.sync_ack' ||
        payload.eventType === 'athlete.deauthorize'
          ? payload.eventType
          : 'activity.create',
      externalUserId,
      externalObjectId:
        typeof payload.externalObjectId === 'string' ? payload.externalObjectId : '',
      occurredAt:
        typeof payload.occurredAt === 'string' ? payload.occurredAt : new Date(params.nowMs ?? Date.now()).toISOString(),
      signatureHeader: params.signature ?? undefined,
      rawPayloadHash,
      payload,
    },
    userId,
    consentSnapshot: session.snapshot,
    env,
    nowMs: params.nowMs,
  });

  session.snapshot = updatedConsentSnapshot;

  return {
    httpStatus: result.status === 'rejected_invalid_signature' ? 401 : 200,
    body: {
      accepted: result.accepted,
      idempotentReplay: result.idempotentReplay,
      status: result.status,
      reason: result.reason,
      enqueuedJobId: result.enqueuedJobId,
    },
  };
}
