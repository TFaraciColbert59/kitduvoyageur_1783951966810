/**
 * Lot 08 — Bus d'événements domaine Cross-App (`activity.*.v1`)
 * Adossé à `public.activity_domain_outbox` (idempotency_key unique) pour garantir
 * la synchronisation fiable vers Matériel, Carnets, Voyages, Clubs, Pokédex, Sécurité et IA.
 */

export type ActivityDomainEventType =
  | 'activity.started.v1'
  | 'activity.paused.v1'
  | 'activity.waypoint_added.v1'
  | 'activity.completed.v1'
  | 'activity.enriched.v1'
  | 'activity.cropped.v1'
  | 'activity.split.v1'
  | 'activity.sport_changed.v1'
  | 'activity.deleted.v1';

export type ActivitySourceOrigin =
  | 'lkdv_native'
  | 'lkdv_web'
  | 'apple_healthkit'
  | 'garmin_fit'
  | 'suunto_fit'
  | 'coros_fit'
  | 'strava_api'
  | 'gpx_import'
  | 'manual';

export interface ActivityDomainEventBase<TType extends ActivityDomainEventType, TPayload> {
  readonly eventType: TType;
  readonly sessionId: string;
  readonly userId: string;
  readonly occurredAtIso: string;
  readonly revision: number;
  readonly idempotencyKey: string;
  readonly payload: TPayload;
}

export interface ActivityCompletedPayload {
  sportSlug: string;
  sourceOrigin: ActivitySourceOrigin;
  distanceM: number;
  movingS: number;
  elapsedS: number;
  elevGainM: number;
  elevLossM: number;
  avgHrBpm?: number | null;
  maxHrBpm?: number | null;
  restingHrBpm?: number | null;
  rpe?: number | null;
  gearIds: string[];
  tripId?: string | null;
  tripStepId?: string | null;
  carnetId?: string | null;
  waypoints: Array<{ id: string; kind: string; label: string; lat: number; lng: number }>;
  photosCount: number;
  coverPhotoUrl?: string | null;
  title: string;
  notes?: string;
  eligibleForLeaderboards?: boolean;
  isElectricAssisted?: boolean;
}

export interface ActivityCroppedPayload {
  sportSlug: string;
  gearIds: string[];
  previousDistanceM: number;
  previousMovingS: number;
  newDistanceM: number;
  newMovingS: number;
  reason: 'auto_crop_vehicle' | 'manual_trim';
}

export interface ActivitySplitPayload {
  sportSlug: string;
  gearIds: string[];
  parentDistanceM: number;
  parentMovingS: number;
  children: Array<{
    childSessionId: string;
    distanceM: number;
    movingS: number;
  }>;
}

export interface ActivityDeletedPayload {
  sportSlug: string;
  gearIds: string[];
  distanceM: number;
  movingS: number;
  cyclesCount?: number;
}

export type ActivityDomainEvent =
  | ActivityDomainEventBase<'activity.started.v1', { sportSlug: string; startedAtIso: string }>
  | ActivityDomainEventBase<'activity.paused.v1', { reason: 'manual' | 'auto_pause' | 'bivouac_sleep' }>
  | ActivityDomainEventBase<'activity.waypoint_added.v1', { id: string; kind: string; label: string; lat: number; lng: number }>
  | ActivityDomainEventBase<'activity.completed.v1', ActivityCompletedPayload>
  | ActivityDomainEventBase<'activity.enriched.v1', { title?: string; rpe?: number; notes?: string }>
  | ActivityDomainEventBase<'activity.cropped.v1', ActivityCroppedPayload>
  | ActivityDomainEventBase<'activity.split.v1', ActivitySplitPayload>
  | ActivityDomainEventBase<'activity.sport_changed.v1', { previousSlug: string; nextSlug: string }>
  | ActivityDomainEventBase<'activity.deleted.v1', ActivityDeletedPayload>;

export interface ActivityOutboxInsertRow {
  event_type: ActivityDomainEventType;
  session_id: string;
  user_id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

export function buildEventIdempotencyKey(
  eventType: ActivityDomainEventType,
  sessionId: string,
  revision = 1,
): string {
  return `${eventType}:${sessionId}:v${Math.max(1, Math.floor(revision))}`;
}

export function createActivityDomainEvent<TType extends ActivityDomainEventType>(
  eventType: TType,
  params: {
    sessionId: string;
    userId: string;
    revision?: number;
    occurredAtIso?: string;
    payload: Extract<ActivityDomainEvent, { eventType: TType }>['payload'];
  },
): Extract<ActivityDomainEvent, { eventType: TType }> {
  const revision = params.revision ?? 1;
  return {
    eventType,
    sessionId: params.sessionId,
    userId: params.userId,
    occurredAtIso: params.occurredAtIso ?? new Date().toISOString(),
    revision,
    idempotencyKey: buildEventIdempotencyKey(eventType, params.sessionId, revision),
    payload: params.payload,
  } as Extract<ActivityDomainEvent, { eventType: TType }>;
}

export function toActivityOutboxRow(event: ActivityDomainEvent): ActivityOutboxInsertRow {
  return {
    event_type: event.eventType,
    session_id: event.sessionId,
    user_id: event.userId,
    idempotency_key: event.idempotencyKey,
    payload: event.payload as unknown as Record<string, unknown>,
  };
}

type EventListener = (event: ActivityDomainEvent) => void | Promise<void>;
const listeners = new Set<EventListener>();
const processedKeys = new Set<string>();

export function subscribeActivityEvent(listener: EventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetActivityEventBusForTests(): void {
  listeners.clear();
  processedKeys.clear();
}

/**
 * Émission idempotente dans le bus in-process (déduplique automatiquement par `idempotencyKey`).
 */
export async function emitActivityEvent(event: ActivityDomainEvent): Promise<{ delivered: boolean }> {
  if (processedKeys.has(event.idempotencyKey)) {
    return { delivered: false };
  }
  processedKeys.add(event.idempotencyKey);
  const deliveries = Array.from(listeners).map((fn) => Promise.resolve(fn(event)));
  await Promise.all(deliveries);
  return { delivered: true };
}
