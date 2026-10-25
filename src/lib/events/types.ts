import { z } from 'zod';

export const LKV_EVENT_TYPES = [
  'trip.created',
  'trip.updated',
  'trip.phase_changed',
  'trip.completed',
  'trip.step_completed',
  'gear.packed',
  'gear.unpacked',
  'place.reviewed',
  'place.saved',
  'crew.created',
  'crew.joined',
  'crew.left',
  'carnet.published',
  'comment.created',
] as const;

export type LkvEventType = (typeof LKV_EVENT_TYPES)[number] | (string & {});

export const LKV_ENTITY_TYPES = [
  'trip',
  'crew',
  'place',
  'gear',
  'carnet',
  'comment',
  'user',
] as const;

export type LkvEntityType = (typeof LKV_ENTITY_TYPES)[number] | (string & {});

export const LKV_VISIBILITIES = ['private', 'crew', 'public'] as const;
export type LkvEventVisibility = (typeof LKV_VISIBILITIES)[number];

export const lkvEventSchema = z.object({
  id: z.string().uuid().optional(),
  event_type: z.string().min(1),
  actor_id: z.string().uuid(),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  visibility: z.enum(LKV_VISIBILITIES).default('private'),
  crew_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
});

export type CreateEventInput = z.input<typeof lkvEventSchema>;

export interface LkvEvent {
  id: string;
  event_type: LkvEventType;
  actor_id: string;
  entity_type: LkvEntityType;
  entity_id: string;
  metadata: Record<string, any>;
  visibility: LkvEventVisibility;
  crew_id: string | null;
  created_at: string;
}

/**
 * Règle légale RGPD : Rétention maximale de 13 mois pour les événements d'activité.
 * 13 mois civils ≈ 396 jours (13 * 30.5 jours).
 */
export const GDPR_RETENTION_MONTHS = 13;

export function isEventExpiredForGdpr(dateIso: string, referenceDate: Date = new Date()): boolean {
  const eventTime = new Date(dateIso).getTime();
  if (isNaN(eventTime)) return false;

  const expirationCutoff = new Date(referenceDate);
  expirationCutoff.setMonth(expirationCutoff.getMonth() - GDPR_RETENTION_MONTHS);

  return eventTime < expirationCutoff.getTime();
}
