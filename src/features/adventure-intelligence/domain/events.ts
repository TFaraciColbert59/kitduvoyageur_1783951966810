/**
 * Événements de domaine — ADR-AI-006.
 *
 * `adventure_domain_events` est une file idempotente : la clé d'idempotence
 * reprend `event_type + entity_id + processor_version` (unicité en base).
 * `lkv_events` reste réservé aux événements visibles utilisateur.
 */

export const ADVENTURE_DOMAIN_EVENT_TYPES = [
  'adventure.created',
  'adventure.plan.generated',
  'adventure.plan.recalculated',
  'weather.changed',
  'price.changed',
  'booking.unavailable',
  'trail.report.created',
  'trail.report.confirmed',
  'trail.condition.changed',
  'hike.started',
  'hike.position.recorded',
  'hike.offroute.detected',
  'hike.pace.deviation',
  'hike.completed',
  'performance.profile.updated',
  'gear.inventory.changed',
  'decision.confirmation.required',
  'consent.revoked',
] as const;

export type AdventureDomainEventType = (typeof ADVENTURE_DOMAIN_EVENT_TYPES)[number];

export type AdventureDomainEventStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface AdventureDomainEvent {
  type: AdventureDomainEventType;
  entityType: string;
  entityId: string;
  actorId?: string;
  payload: Record<string, unknown>;
  processorVersion: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface BuildDomainEventInput {
  type: AdventureDomainEventType;
  entityType: string;
  entityId: string;
  processorVersion: string;
  payload?: Record<string, unknown>;
  actorId?: string;
  createdAt?: string;
}

/** Construit l'événement et sa clé d'idempotence stable. */
export function buildDomainEvent(input: BuildDomainEventInput): AdventureDomainEvent {
  return {
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId,
    payload: input.payload ?? {},
    processorVersion: input.processorVersion,
    idempotencyKey: `${input.type}:${input.entityId}:${input.processorVersion}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
