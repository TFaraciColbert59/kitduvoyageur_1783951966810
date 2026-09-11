/**
 * A10 (10.7) — Traitement des événements de domaine (purge sur révocation).
 *
 * Client injecté (`AdventureEventProcessingClient`) : aucune dépendance
 * Supabase ici, testable sans réseau. Le handler `consent.revoked` matérialise
 * le droit à l'effacement (audit #12) :
 *   1. suppression des observations personnelles ;
 *   2. suppression du profil courant et de ses versions ;
 *   3. suppression des prédictions segment et route ;
 *   4. suppression des agrégats collectifs des segments contribués
 *      (recalcul ultérieur par le cron collectif, sans l'utilisateur) ;
 *   5. marquage de l'événement `processed`.
 * L'opération est idempotente (rejouable sans erreur) et une erreur marque
 * l'événement `failed` sans interrompre le lot.
 */
import 'server-only';

/** Version de traitement des événements de domaine Adventure Intelligence. */
export const ADVENTURE_EVENT_PROCESSOR_VERSION = 'a10-v1';

/** Taille de lot par défaut d'une exécution de cron. */
export const ADVENTURE_EVENT_CLAIM_LIMIT = 10;

export const CONSENT_REVOKED_EVENT_TYPE = 'consent.revoked';

export interface AdventureEventRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
}

export interface AdventureEventProcessingClient {
  /** Réclame atomiquement des événements `pending` (SKIP LOCKED côté SQL). */
  claimPendingEvents(limit: number): Promise<AdventureEventRow[]>;
  /** Segments auxquels l'utilisateur a contribué (pour invalider les agrégats). */
  listContributedSegmentIds(userId: string): Promise<number[]>;
  deleteObservations(userId: string): Promise<void>;
  deleteProfileVersions(userId: string): Promise<void>;
  deleteProfile(userId: string): Promise<void>;
  deleteSegmentPredictions(userId: string): Promise<void>;
  deleteRoutePredictions(userId: string): Promise<void>;
  deleteCollectiveAggregates(segmentIds: number[]): Promise<void>;
  markEventProcessed(eventId: string): Promise<void>;
  markEventFailed(eventId: string, error: string): Promise<void>;
}

export interface ProcessAdventureEventsOptions {
  limit?: number;
}

export interface ProcessAdventureEventsResult {
  processed: number;
  failed: number;
  skipped: number;
}

function eventUserId(event: AdventureEventRow): string | null {
  const payloadUserId = event.payload?.userId;
  if (typeof payloadUserId === 'string' && payloadUserId.length > 0) return payloadUserId;
  if (typeof event.actor_id === 'string' && event.actor_id.length > 0) return event.actor_id;
  return null;
}

async function handleConsentRevoked(
  client: AdventureEventProcessingClient,
  userId: string
): Promise<void> {
  await client.deleteObservations(userId);
  await client.deleteProfileVersions(userId);
  await client.deleteProfile(userId);
  await client.deleteSegmentPredictions(userId);
  await client.deleteRoutePredictions(userId);

  // Les agrégats sont anonymes : on invalide ceux des segments contribués
  // (recalcul ultérieur sans l'utilisateur révoqué).
  const segmentIds = [...new Set(await client.listContributedSegmentIds(userId))];
  if (segmentIds.length > 0) {
    await client.deleteCollectiveAggregates(segmentIds);
  }
}

/**
 * Traite un lot d'événements réclamés. Un type inconnu est marqué `processed`
 * (no-op journalisé par les compteurs) pour ne jamais bloquer la file.
 */
export async function processAdventureEvents(
  client: AdventureEventProcessingClient,
  options: ProcessAdventureEventsOptions = {}
): Promise<ProcessAdventureEventsResult> {
  const limit = Math.max(1, Math.trunc(options.limit ?? ADVENTURE_EVENT_CLAIM_LIMIT));
  const events = await client.claimPendingEvents(limit);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of events) {
    if (event.event_type !== CONSENT_REVOKED_EVENT_TYPE) {
      await client.markEventProcessed(event.id);
      skipped += 1;
      continue;
    }

    const userId = eventUserId(event);
    if (!userId) {
      await client.markEventFailed(event.id, 'missing_user_id');
      failed += 1;
      continue;
    }

    try {
      await handleConsentRevoked(client, userId);
      await client.markEventProcessed(event.id);
      processed += 1;
    } catch (error) {
      await client.markEventFailed(
        event.id,
        error instanceof Error ? error.message : 'processing_error'
      );
      failed += 1;
    }
  }

  return { processed, failed, skipped };
}
