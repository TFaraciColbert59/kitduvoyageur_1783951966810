/**
 * Finalisation unique d'activité, partage temporaire révocable et filtrage
 * anti-bruit des notifications (P05-07, P05-08, P05-11, P08-04).
 */

export interface ActivityFinalizationRecord {
  sessionId: string;
  operationId: string;
  finalizedAt: string;
}

export class IdempotentActivityFinalizer {
  private readonly done = new Map<string, ActivityFinalizationRecord>();

  finalize(sessionId: string, operationId: string, nowIso = new Date().toISOString()): {
    created: boolean;
    record: ActivityFinalizationRecord;
  } {
    const existing = this.done.get(sessionId);
    if (existing) {
      return { created: false, record: existing };
    }
    const record: ActivityFinalizationRecord = { sessionId, operationId, finalizedAt: nowIso };
    this.done.set(sessionId, record);
    return { created: true, record };
  }
}

export interface TempShareGrant {
  token: string;
  tripId: string;
  expiresAtMs: number;
  revoked: boolean;
}

export function isTempShareValid(grant: TempShareGrant, nowMs = Date.now()): boolean {
  return !grant.revoked && Number.isFinite(grant.expiresAtMs) && nowMs < grant.expiresAtMs;
}

export type NotificationSignal =
  | 'route_revision_published'
  | 'trip_cancelled'
  | 'severe_weather_alert'
  | 'step_postponed'
  | 'minor_note_edit'
  | 'cosmetic_reorder';

export function shouldNotifyChange(signal: NotificationSignal): boolean {
  return (
    signal === 'route_revision_published' ||
    signal === 'trip_cancelled' ||
    signal === 'severe_weather_alert' ||
    signal === 'step_postponed'
  );
}
