/**
 * Politique pure de reprise des sessions GPS (A10 — 10.5).
 *
 * Sur échec de traitement : backoff exponentiel `2^attempts` minutes, état
 * terminal `dead_letter` à partir de 5 tentatives (aligné sur le claim SQL
 * `a2_claim_pending_sessions`). Aucune I/O ici : la décision est testable.
 */

/** Nombre maximal de tentatives avant dead-letter (aligné sur le claim SQL). */
export const MAX_PROCESSING_ATTEMPTS = 5;

/** Durée du lease de traitement en minutes (aligné sur le claim SQL). */
export const SESSION_LEASE_MINUTES = 15;

export interface SessionFailurePlan {
  /** `pending` = reprise programmée, `dead_letter` = échec terminal. */
  status: 'pending' | 'dead_letter';
  /** Horodatage ISO de reprise, `null` si terminal. */
  nextRetryAt: string | null;
  /** Délai appliqué en minutes (2^attempts). */
  delayMinutes: number;
  /** Vrai si le nombre maximal de tentatives est atteint. */
  exhausted: boolean;
}

function safeAttempts(attempts: number): number {
  if (!Number.isFinite(attempts)) return 0;
  return Math.max(0, Math.trunc(attempts));
}

/** Backoff exponentiel : 2^attempts minutes (1, 2, 4, 8, 16…). */
export function computeRetryDelayMinutes(attempts: number): number {
  return 2 ** safeAttempts(attempts);
}

/**
 * Décide du sort d'une session après un échec de traitement :
 * reprise programmée (`pending` + `next_retry_at`) ou dead-letter terminal.
 */
export function planSessionFailure(attempts: number, nowIso: string): SessionFailurePlan {
  const normalized = safeAttempts(attempts);

  if (normalized >= MAX_PROCESSING_ATTEMPTS) {
    return { status: 'dead_letter', nextRetryAt: null, delayMinutes: 0, exhausted: true };
  }

  const delayMinutes = computeRetryDelayMinutes(normalized);
  const nowMs = Date.parse(nowIso);
  const baseMs = Number.isFinite(nowMs) ? nowMs : Date.now();

  return {
    status: 'pending',
    nextRetryAt: new Date(baseMs + delayMinutes * 60_000).toISOString(),
    delayMinutes,
    exhausted: false,
  };
}
