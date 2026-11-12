/**
 * Lecture de la réponse de `/api/explorer/v2/activity/finish`.
 *
 * Le serveur distingue `saved`, `duplicate`, `already_finished` et
 * `conflict`. L'écran Bilan doit refléter ces états sans transformer une fin
 * déjà constatée en « Sortie enregistrée », et sans remettre en file une
 * erreur définitive (400/403/409). Un `already_finished` sans `summaryId`
 * devient `already_finished_without_summary` : la séance est close, mais
 * aucun bilan n'est connu. Les 408/429 restent rejouables.
 */

export type SummarySavedState =
  | 'pending'
  | 'saved'
  | 'already_finished'
  /** Séance close côté serveur, mais aucun résumé n'a pu être retrouvé. */
  | 'already_finished_without_summary'
  | 'local'
  | 'unauthenticated'
  | 'conflict'
  | 'failed';

export interface FinishOutcome {
  state: Exclude<SummarySavedState, 'pending' | 'local'>;
  /** Une nouvelle tentative automatique a une chance d'aboutir. */
  retryable: boolean;
  summaryId: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readSummaryId(value: unknown): string | null | 'invalid' {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && UUID_PATTERN.test(value)) return value;
  return 'invalid';
}

export function readFinishOutcome(httpStatus: number, payload: unknown): FinishOutcome {
  if (httpStatus === 401) {
    return { state: 'unauthenticated', retryable: false, summaryId: null };
  }
  if (httpStatus === 409) {
    return { state: 'conflict', retryable: false, summaryId: null };
  }
  // 408 et 429 sont transitoires : le bilan doit rester rejouable.
  if (httpStatus === 408 || httpStatus === 429) {
    return { state: 'failed', retryable: true, summaryId: null };
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return { state: 'failed', retryable: false, summaryId: null };
  }
  if (httpStatus >= 500) {
    return { state: 'failed', retryable: true, summaryId: null };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { state: 'failed', retryable: true, summaryId: null };
  }

  const body = payload as { status?: unknown; summaryId?: unknown };
  const summaryId = readSummaryId(body.summaryId);

  if (body.status === 'saved' || body.status === 'duplicate') {
    if (summaryId === 'invalid' || summaryId === null) {
      return { state: 'failed', retryable: true, summaryId: null };
    }
    return { state: 'saved', retryable: false, summaryId };
  }

  if (body.status === 'already_finished') {
    if (summaryId === 'invalid') {
      return { state: 'failed', retryable: true, summaryId: null };
    }
    // Séance close sans résumé retrouvé : ne jamais annoncer « enregistrée »
    // ni « aucun doublon » (il n'y a peut-être aucun bilan à montrer).
    return {
      state: summaryId === null ? 'already_finished_without_summary' : 'already_finished',
      retryable: false,
      summaryId,
    };
  }

  return { state: 'failed', retryable: true, summaryId: null };
}
