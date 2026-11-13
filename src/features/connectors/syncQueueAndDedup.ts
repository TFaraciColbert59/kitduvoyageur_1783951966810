import { createHmac } from 'crypto';
import { evaluateConnectorConsent } from './oauthAndConsent';
import { inspectProviderCredentials, PARTNER_CONNECTOR_DEFINITIONS } from './registry';
import type {
  ActivityProvenanceRecord,
  ConnectorConsentSnapshot,
  ConnectorEnvReader,
  DeduplicationOutcome,
  IncomingExternalActivityCandidate,
  PartnerProviderId,
  PartnerWebhookEvent,
  SyncJobKind,
  SyncQueueJob,
  WebhookIngestionResult,
} from './types';

/**
 * Construit une clé d'idempotence déterministe pour un événement webhook partenaire.
 */
export function buildWebhookIdempotencyKey(event: PartnerWebhookEvent): string {
  const deliveryPart = event.deliveryId.trim();
  if (deliveryPart.length > 0) {
    return `webhook:${event.providerId}:delivery:${deliveryPart}`;
  }
  return `webhook:${event.providerId}:${event.eventType}:${event.externalObjectId}:${event.rawPayloadHash}`;
}

/**
 * Construit une clé d'idempotence déterministe pour l'envoi d'un itinéraire ou de ses waypoints (S3.23 / K6.06 / K6.12 / K6.13).
 */
export function buildRoutePushIdempotencyKey(params: {
  userId: string;
  providerId: PartnerProviderId;
  routeId: string;
  revision: number;
  kind: SyncJobKind;
  deviceModelId?: string;
}): string {
  const modelSuffix = params.deviceModelId ? `:${params.deviceModelId}` : '';
  return `sync:${params.kind}:${params.userId}:${params.providerId}:${params.routeId}:v${params.revision}${modelSuffix}`;
}

/**
 * Construit une clé de déduplication fournisseur + activité externe (S6.04 / K6.06 / S6.27).
 */
export function buildActivityDeduplicationKey(
  userId: string,
  providerId: PartnerProviderId,
  externalActivityId: string
): string {
  return `activity:${userId}:${providerId}:${externalActivityId.trim()}`;
}

/**
 * Calcule la distance approximative en mètres entre deux points [lat, lng] (Haversine).
 */
function haversineDistanceMeters(
  a: readonly [number, number],
  b: readonly [number, number]
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Évalue la déduplication multi-sources d'une activité entrante (K6.06, S6.04, S6.27, Recherche 08 & 13).
 *
 * Règles appliquées :
 * 1. Anti-boucle de synchronisation (`LKDV -> Partenaire -> LKDV`) : rejet immédiat (`reject_sync_loop`).
 * 2. Correspondance exacte d'identifiant externe (`providerId + externalActivityId`) ou d'empreinte fichier (`fileHash`) :
 *    - Si la séance locale a été supprimée (`deletedLocallyAt`), rejet du retour tardif (`reject_locally_deleted_tombstone`).
 *    - Si le nouveau flux apporte des séries absentes (`gps_route`, `heart_rate_series`, `power_series`), enrichissement (`link_and_enrich_existing`).
 *    - Sinon, doublon exact ignoré (`ignore_exact_duplicate`).
 * 3. Rapprochement multi-canaux (ex: même sortie enregistrée sur montre Garmin et reçue via Garmin Connect + Strava) :
 *    - Fenêtre de départ <= 120 secondes, écart de durée <= max(60s, 10%), écart de distance <= max(250m, 8%),
 *      et départ GPS compatible (<= 250m si les deux traces ont un point de départ).
 *    - Deux sorties consécutives distinctes (départ espacé > 120s) ne sont jamais fusionnées par erreur.
 */
export function evaluateActivityDeduplication(
  candidate: IncomingExternalActivityCandidate,
  existingRecords: readonly ActivityProvenanceRecord[]
): DeduplicationOutcome {
  const deduplicationKey = buildActivityDeduplicationKey(
    candidate.userId,
    candidate.providerId,
    candidate.externalActivityId
  );

  // 1. Détection de boucle de synchronisation (LKDV -> Partner -> LKDV)
  if (
    candidate.originApplication === 'lkdv' ||
    (candidate.sourceChain && candidate.sourceChain.some((s) => s.toLowerCase() === 'lkdv'))
  ) {
    return {
      decision: 'reject_sync_loop',
      deduplicationKey,
      reason: 'Boucle de synchronisation détectée (activité originaire de LKDV ré-émise par un partenaire).',
    };
  }

  const userRecords = existingRecords.filter((rec) => rec.userId === candidate.userId);

  // 2. Correspondance par identifiant externe ou hash de fichier
  for (const record of userRecords) {
    const exactMatch = record.linkedSources.some(
      (src) =>
        (src.providerId === candidate.providerId &&
          src.externalActivityId === candidate.externalActivityId) ||
        Boolean(candidate.fileHash && src.fileHash && candidate.fileHash === src.fileHash)
    );

    if (exactMatch) {
      if (record.deletedLocallyAt) {
        return {
          decision: 'reject_locally_deleted_tombstone',
          deduplicationKey,
          canonicalActivityId: record.canonicalActivityId,
          reason: `L'activité ${record.canonicalActivityId} a été supprimée localement le ${record.deletedLocallyAt} ; synchronisation tardive ignorée.`,
        };
      }

      const enrichmentFields = computeEnrichmentFields(record, candidate);
      if (enrichmentFields.length > 0) {
        return {
          decision: 'link_and_enrich_existing',
          deduplicationKey,
          canonicalActivityId: record.canonicalActivityId,
          enrichmentFields,
          reason: `Activité connue enrichie avec : ${enrichmentFields.join(', ')}.`,
        };
      }

      return {
        decision: 'ignore_exact_duplicate',
        deduplicationKey,
        canonicalActivityId: record.canonicalActivityId,
        reason: `Doublon exact (${candidate.providerId}:${candidate.externalActivityId}) déjà rattaché à ${record.canonicalActivityId}.`,
      };
    }
  }

  // 3. Rapprochement multi-voies contrôlé (ex: Garmin Connect + Strava pour la même séance)
  const candidateStartMs = Date.parse(candidate.startTimeIso);
  if (!Number.isNaN(candidateStartMs)) {
    for (const record of userRecords) {
      const recordStartMs = Date.parse(record.startTimeIso);
      if (Number.isNaN(recordStartMs)) continue;

      const startDiffSeconds = Math.abs(candidateStartMs - recordStartMs) / 1000;
      if (startDiffSeconds > 120) continue;

      const durationDiff = Math.abs(candidate.durationSeconds - record.durationSeconds);
      const maxAllowedDurationDiff = Math.max(60, record.durationSeconds * 0.1);
      if (durationDiff > maxAllowedDurationDiff) continue;

      const distanceDiff = Math.abs(candidate.distanceMeters - record.distanceMeters);
      const maxAllowedDistanceDiff = Math.max(250, record.distanceMeters * 0.08);
      if (distanceDiff > maxAllowedDistanceDiff) continue;

      if (candidate.startLatLng && record.startLatLng) {
        const startDistance = haversineDistanceMeters(candidate.startLatLng, record.startLatLng);
        if (startDistance > 250) continue;
      }

      if (record.deletedLocallyAt) {
        return {
          decision: 'reject_locally_deleted_tombstone',
          deduplicationKey,
          canonicalActivityId: record.canonicalActivityId,
          reason: `Séance correspondante ${record.canonicalActivityId} supprimée localement ; doublon croisé ignoré.`,
        };
      }

      const enrichmentFields = computeEnrichmentFields(record, candidate);
      return {
        decision: 'link_and_enrich_existing',
        deduplicationKey,
        canonicalActivityId: record.canonicalActivityId,
        enrichmentFields,
        reason: `Activité reçue via une seconde voie (${candidate.providerId}) liée sans perte à la séance canonique ${record.canonicalActivityId}.`,
      };
    }
  }

  return {
    decision: 'create_new',
    deduplicationKey,
    reason: 'Aucune séance existante correspondante ; création d’une nouvelle activité canonique.',
  };
}

function computeEnrichmentFields(
  record: ActivityProvenanceRecord,
  candidate: IncomingExternalActivityCandidate
): ('gps_route' | 'heart_rate_series' | 'power_series')[] {
  const fields: ('gps_route' | 'heart_rate_series' | 'power_series')[] = [];
  if (!record.hasGpsRoute && candidate.hasGpsRoute) fields.push('gps_route');
  if (!record.hasHeartRateSeries && candidate.hasHeartRateSeries) fields.push('heart_rate_series');
  if (!record.hasPowerSeries && candidate.hasPowerSeries) fields.push('power_series');
  return fields;
}

/**
 * Calcule le délai de backoff exponentiel borné (en millisecondes) pour une tentative de synchronisation.
 */
export function computeRetryBackoffMs(
  attempt: number,
  baseDelayMs = 2000,
  maxDelayMs = 300_000
): number {
  const clampedAttempt = Math.max(1, attempt);
  const exponential = baseDelayMs * Math.pow(2, clampedAttempt - 1);
  return Math.min(maxDelayMs, exponential);
}

/**
 * Calcule la signature HMAC-SHA256 attendue pour vérifier l'authenticité d'un webhook partenaire.
 */
export function computeWebhookSignatureHmac(secret: string, rawPayloadHash: string): string {
  return createHmac('sha256', secret).update(rawPayloadHash, 'utf8').digest('hex');
}

/**
 * File de synchronisation idempotente et gestionnaire de webhooks partenaires (D01).
 */
export class IdempotentConnectorSyncEngine {
  private readonly processedWebhookKeys = new Map<string, WebhookIngestionResult>();
  private readonly jobsByKey = new Map<string, SyncQueueJob>();
  private jobCounter = 0;

  /**
   * Traite un événement webhook partenaire avec :
   * - Vérification fail-closed des credentials et du secret de webhook.
   * - Vérification HMAC de la signature.
   * - Idempotence stricte (un rejeu du même deliveryId ou événement ne crée aucun job ni effet de bord).
   * - Prise en compte immédiate de `athlete.deauthorize` (révocation et annulation des jobs en attente).
   */
  public ingestWebhookEvent(params: {
    event: PartnerWebhookEvent;
    userId: string;
    consentSnapshot: ConnectorConsentSnapshot;
    env?: ConnectorEnvReader;
    nowMs?: number;
  }): {
    result: WebhookIngestionResult;
    updatedConsentSnapshot: ConnectorConsentSnapshot;
  } {
    const { event, userId, env } = params;
    let consentSnapshot = params.consentSnapshot;
    const nowMs = params.nowMs ?? Date.now();
    const idempotencyKey = buildWebhookIdempotencyKey(event);

    // 1. Idempotence stricte : si déjà traité avec succès ou deauthorize, retourner sans effet de bord
    const previous = this.processedWebhookKeys.get(idempotencyKey);
    if (previous) {
      return {
        result: {
          ...previous,
          idempotentReplay: true,
          status: 'duplicate_ignored',
          enqueuedJobId: null,
          reason: `Webhook déjà traité (${idempotencyKey}) : rejeu ignoré sans effet de bord.`,
        },
        updatedConsentSnapshot: consentSnapshot,
      };
    }

    // 2. Fail-closed si les credentials ou le secret webhook du fournisseur manquent
    const def = PARTNER_CONNECTOR_DEFINITIONS[event.providerId];
    const { configured, missingEnvVars } = inspectProviderCredentials(event.providerId, env);
    if (!configured) {
      return {
        result: {
          accepted: false,
          idempotentReplay: false,
          idempotencyKey,
          status: 'rejected_credentials_missing',
          enqueuedJobId: null,
          reason: `Webhook ${def.label} rejeté (fail-closed) : variables d'environnement manquantes (${missingEnvVars.join(', ')}).`,
        },
        updatedConsentSnapshot: consentSnapshot,
      };
    }

    const envSource = env ?? (typeof process !== 'undefined' ? process.env : {});
    if (def.webhookSecretEnvVar) {
      const secret = envSource[def.webhookSecretEnvVar]?.trim();
      if (!secret) {
        return {
          result: {
            accepted: false,
            idempotentReplay: false,
            idempotencyKey,
            status: 'rejected_credentials_missing',
            enqueuedJobId: null,
            reason: `Secret webhook ${def.webhookSecretEnvVar} manquant.`,
          },
          updatedConsentSnapshot: consentSnapshot,
        };
      }

      const expectedSignature = computeWebhookSignatureHmac(secret, event.rawPayloadHash);
      if (!event.signatureHeader || event.signatureHeader !== expectedSignature) {
        return {
          result: {
            accepted: false,
            idempotentReplay: false,
            idempotencyKey,
            status: 'rejected_invalid_signature',
            enqueuedJobId: null,
            reason: `Signature HMAC du webhook ${def.label} absente ou invalide.`,
          },
          updatedConsentSnapshot: consentSnapshot,
        };
      }
    }

    // 3. Cas de déconnexion / révocation initiée côté partenaire (ex: Strava athlete.deauthorize)
    if (event.eventType === 'athlete.deauthorize') {
      this.cancelPendingJobsForProvider(userId, event.providerId, nowMs);
      const revokedIso = new Date(nowMs).toISOString();
      const existingGrant = consentSnapshot.providers[event.providerId];
      consentSnapshot = {
        ...consentSnapshot,
        providers: {
          ...consentSnapshot.providers,
          [event.providerId]: {
            providerId: event.providerId,
            connected: false,
            allowedScopes: [],
            grantedAt: existingGrant?.grantedAt ?? null,
            revokedAt: revokedIso,
          },
        },
      };

      const deauthResult: WebhookIngestionResult = {
        accepted: true,
        idempotentReplay: false,
        idempotencyKey,
        status: 'deauthorized_applied',
        enqueuedJobId: null,
        reason: `Révocation distante ${def.label} appliquée et jobs en attente annulés.`,
      };
      this.processedWebhookKeys.set(idempotencyKey, deauthResult);
      return {
        result: deauthResult,
        updatedConsentSnapshot: consentSnapshot,
      };
    }

    // 4. Vérification du consentement P01 S6.16 avant d'accepter un import d'activité
    const consentEval = evaluateConnectorConsent(
      consentSnapshot,
      event.providerId,
      'activity_import'
    );
    if (!consentEval.allowed) {
      return {
        result: {
          accepted: false,
          idempotentReplay: false,
          idempotencyKey,
          status: 'rejected_consent_revoked',
          enqueuedJobId: null,
          reason: consentEval.reason,
        },
        updatedConsentSnapshot: consentSnapshot,
      };
    }

    // 5. Enqueue idempotent du job d'import
    const jobKey = `job:activity_import:${userId}:${event.providerId}:${event.externalObjectId}`;
    let job = this.jobsByKey.get(jobKey);
    if (!job) {
      this.jobCounter += 1;
      job = {
        jobId: `sync_job_${this.jobCounter}`,
        idempotencyKey: jobKey,
        userId,
        providerId: event.providerId,
        kind: 'activity_import',
        targetEntityId: event.externalObjectId,
        revision: 1,
        status: 'queued',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAtMs: null,
        lastError: null,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      this.jobsByKey.set(jobKey, job);
    }

    const okResult: WebhookIngestionResult = {
      accepted: true,
      idempotentReplay: false,
      idempotencyKey,
      status: 'processed',
      enqueuedJobId: job.jobId,
      reason: `Événement ${event.eventType} accepté et placé en file (${job.jobId}).`,
    };
    this.processedWebhookKeys.set(idempotencyKey, okResult);

    return {
      result: okResult,
      updatedConsentSnapshot: consentSnapshot,
    };
  }

  /**
   * Place en file d'attente un envoi sortant d'itinéraire, de waypoints ou de Live Sync (S3.23, K6.06, K6.12, K6.13).
   * - Respecte strictement le consentement P01 S6.16 avant toute synchronisation sortante.
   * - Refuse en fail-closed si les credentials partenaires manquent.
   * - Déduplique les appels identiques (même routeId + revision + providerId + kind).
   * - Remplace (`superseded_by_newer_revision`) toute révision plus ancienne encore en attente.
   */
  public enqueueOutboundRouteSync(params: {
    userId: string;
    providerId: PartnerProviderId;
    routeId: string;
    revision: number;
    kind: 'route_push' | 'waypoint_push' | 'live_sync_route';
    deviceModelId?: string;
    consentSnapshot: ConnectorConsentSnapshot;
    env?: ConnectorEnvReader;
    nowMs?: number;
  }): {
    job: SyncQueueJob;
    deduplicatedReplay: boolean;
    supersededJobIds: string[];
  } {
    const nowMs = params.nowMs ?? Date.now();
    const idempotencyKey = buildRoutePushIdempotencyKey({
      userId: params.userId,
      providerId: params.providerId,
      routeId: params.routeId,
      revision: params.revision,
      kind: params.kind,
      deviceModelId: params.deviceModelId,
    });

    const existingJob = this.jobsByKey.get(idempotencyKey);
    if (existingJob) {
      return {
        job: existingJob,
        deduplicatedReplay: true,
        supersededJobIds: [],
      };
    }

    const usageScope =
      params.kind === 'waypoint_push'
        ? 'waypoint_export'
        : params.kind === 'live_sync_route'
          ? 'live_sync'
          : 'route_export';

    // 1. Vérification du consentement P01 S6.16 avant toute synchronisation sortante
    const consentEval = evaluateConnectorConsent(
      params.consentSnapshot,
      params.providerId,
      usageScope
    );
    if (!consentEval.allowed) {
      this.jobCounter += 1;
      const blockedConsentJob: SyncQueueJob = {
        jobId: `sync_job_${this.jobCounter}`,
        idempotencyKey,
        userId: params.userId,
        providerId: params.providerId,
        kind: params.kind,
        targetEntityId: params.routeId,
        revision: params.revision,
        deviceModelId: params.deviceModelId,
        status: 'blocked_consent_revoked',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAtMs: null,
        lastError: consentEval.reason,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      this.jobsByKey.set(idempotencyKey, blockedConsentJob);
      return {
        job: blockedConsentJob,
        deduplicatedReplay: false,
        supersededJobIds: [],
      };
    }

    // 2. Vérification fail-closed des credentials partenaires
    const { configured, missingEnvVars } = inspectProviderCredentials(params.providerId, params.env);
    if (!configured) {
      this.jobCounter += 1;
      const blockedCredsJob: SyncQueueJob = {
        jobId: `sync_job_${this.jobCounter}`,
        idempotencyKey,
        userId: params.userId,
        providerId: params.providerId,
        kind: params.kind,
        targetEntityId: params.routeId,
        revision: params.revision,
        deviceModelId: params.deviceModelId,
        status: 'blocked_credentials_missing',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAtMs: null,
        lastError: `Credentials partenaires absents (${missingEnvVars.join(', ')}) : envoi cloud bloqué en fail-closed.`,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      this.jobsByKey.set(idempotencyKey, blockedCredsJob);
      return {
        job: blockedCredsJob,
        deduplicatedReplay: false,
        supersededJobIds: [],
      };
    }

    // 3. Gestion des conflits de révision : annuler/superséder les révisions antérieures en attente
    const supersededJobIds: string[] = [];
    for (const candidateJob of this.jobsByKey.values()) {
      if (
        candidateJob.userId === params.userId &&
        candidateJob.providerId === params.providerId &&
        candidateJob.kind === params.kind &&
        candidateJob.targetEntityId === params.routeId &&
        (candidateJob.status === 'queued' || candidateJob.status === 'failed_retryable')
      ) {
        if (candidateJob.revision < params.revision) {
          candidateJob.status = 'superseded_by_newer_revision';
          candidateJob.updatedAtMs = nowMs;
          candidateJob.nextRetryAtMs = null;
          supersededJobIds.push(candidateJob.jobId);
        }
      }
    }

    this.jobCounter += 1;
    const newJob: SyncQueueJob = {
      jobId: `sync_job_${this.jobCounter}`,
      idempotencyKey,
      userId: params.userId,
      providerId: params.providerId,
      kind: params.kind,
      targetEntityId: params.routeId,
      revision: params.revision,
      deviceModelId: params.deviceModelId,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      nextRetryAtMs: null,
      lastError: null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    this.jobsByKey.set(idempotencyKey, newJob);

    return {
      job: newJob,
      deduplicatedReplay: false,
      supersededJobIds,
    };
  }

  /**
   * Enregistre l'échec d'une tentative sur un job et planifie le retry avec backoff exponentiel borné.
   */
  public recordJobAttemptFailure(jobId: string, errorMessage: string, nowMs = Date.now()): SyncQueueJob | null {
    for (const job of this.jobsByKey.values()) {
      if (job.jobId === jobId) {
        job.attempts += 1;
        job.lastError = errorMessage;
        job.updatedAtMs = nowMs;
        if (job.attempts >= job.maxAttempts) {
          job.status = 'failed_terminal';
          job.nextRetryAtMs = null;
        } else {
          job.status = 'failed_retryable';
          job.nextRetryAtMs = nowMs + computeRetryBackoffMs(job.attempts);
        }
        return job;
      }
    }
    return null;
  }

  /**
   * Marque un job comme terminé avec succès.
   */
  public markJobCompleted(jobId: string, nowMs = Date.now()): SyncQueueJob | null {
    for (const job of this.jobsByKey.values()) {
      if (job.jobId === jobId) {
        job.attempts += 1;
        job.status = 'completed';
        job.nextRetryAtMs = null;
        job.lastError = null;
        job.updatedAtMs = nowMs;
        return job;
      }
    }
    return null;
  }

  /**
   * Annule tous les jobs en attente pour un utilisateur et un fournisseur (lors d'une révocation OAuth/consentement).
   */
  public cancelPendingJobsForProvider(
    userId: string,
    providerId: PartnerProviderId,
    nowMs = Date.now()
  ): number {
    let count = 0;
    for (const job of this.jobsByKey.values()) {
      if (
        job.userId === userId &&
        job.providerId === providerId &&
        (job.status === 'queued' || job.status === 'in_progress' || job.status === 'failed_retryable')
      ) {
        job.status = 'cancelled';
        job.nextRetryAtMs = null;
        job.lastError = 'Annulé suite à la révocation du connecteur.';
        job.updatedAtMs = nowMs;
        count += 1;
      }
    }
    return count;
  }

  public listJobsForUser(userId: string): SyncQueueJob[] {
    return Array.from(this.jobsByKey.values()).filter((j) => j.userId === userId);
  }
}
