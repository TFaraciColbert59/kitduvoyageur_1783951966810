import type { ActivityDomainEvent } from '../activityEventBus';

export interface TripStepExecutionProjection {
  tripId: string;
  tripStepId: string | null;
  sessionId: string;
  distanceM: number;
  movingS: number;
  elevGainM: number;
  executedAtIso: string;
  idempotencyKey: string;
}

export interface CarnetDraftBridgePayload {
  carnetUrl: string;
  sessionId: string;
  title: string;
  sportSlug: string;
  distanceKm: number;
  elevGainM: number;
  movingMinutes: number;
  coverPhotoUrl: string | null;
  waypointsCount: number;
  notes: string;
}

/**
 * Construit les projections Cross-App vers `Voyages` (`trip_step_execution_events`)
 * et `Carnets` (`/carnets?nouveau=1&attachSessionId=<id>`).
 */
export function buildCarnetAndTripProjection(event: ActivityDomainEvent): {
  tripExecution: TripStepExecutionProjection | null;
  carnetBridge: CarnetDraftBridgePayload | null;
} {
  if (event.eventType !== 'activity.completed.v1') {
    return { tripExecution: null, carnetBridge: null };
  }

  const p = event.payload;
  const tripExecution: TripStepExecutionProjection | null = p.tripId
    ? {
        tripId: p.tripId,
        tripStepId: p.tripStepId ?? null,
        sessionId: event.sessionId,
        distanceM: Math.round(Math.max(0, p.distanceM)),
        movingS: Math.round(Math.max(0, p.movingS)),
        elevGainM: Math.round(Math.max(0, p.elevGainM)),
        executedAtIso: event.occurredAtIso,
        idempotencyKey: `${event.idempotencyKey}:trip:${p.tripId}`,
      }
    : null;

  const carnetBridge: CarnetDraftBridgePayload = {
    carnetUrl: p.carnetId
      ? `/carnets/${encodeURIComponent(p.carnetId)}?attachSessionId=${encodeURIComponent(event.sessionId)}`
      : `/communaute?create=carnet&attachSessionId=${encodeURIComponent(event.sessionId)}`,
    sessionId: event.sessionId,
    title: p.title,
    sportSlug: p.sportSlug,
    distanceKm: Number((Math.max(0, p.distanceM) / 1000).toFixed(2)),
    elevGainM: Math.round(Math.max(0, p.elevGainM)),
    movingMinutes: Math.round(Math.max(0, p.movingS) / 60),
    coverPhotoUrl: p.coverPhotoUrl ?? null,
    waypointsCount: p.waypoints.length,
    notes: p.notes ?? '',
  };

  return { tripExecution, carnetBridge };
}
