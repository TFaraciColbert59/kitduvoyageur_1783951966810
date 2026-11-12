/**
 * Lecture de la réponse de `/api/explorer/v2/activity/finish`.
 *
 * Le serveur distingue `saved`, `duplicate`, `already_finished` et
 * `conflict`. L'écran Bilan doit refléter ces états sans transformer une fin
 * déjà constatée en « Sortie enregistrée ». Un `already_finished` sans
 * `summaryId` devient `already_finished_without_summary` : la séance est close,
 * mais aucun bilan n'est connu.
 *
 * Deux notions distinctes gouvernent la file hors ligne :
 *   • `retryable` : une nouvelle tentative automatique peut aboutir ;
 *   • `terminal` : l'opération peut être retirée de la file, car la réponse ne
 *     changera pas (400 invalide, 409 conflit d'idempotence).
 *
 * Un 401/403 n'est PAS terminal : une session expirée ou un refus RLS transitoire
 * doit rester en file jusqu'à la reconnexion ou la correction du serveur. Les
 * 404/405/422 peuvent apparaître pendant un déploiement : ils restent eux aussi
 * en file. Seuls 400 et 409 sont définitifs.
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
  /** La réponse est définitive : retirer l'opération de la file est sûr. */
  terminal: boolean;
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
  if (httpStatus === 400) {
    // Corps invalide : rejouer la même requête ne changera rien.
    return { state: 'failed', retryable: false, terminal: true, summaryId: null };
  }
  if (httpStatus === 401) {
    // Session expirée : l'opération reste en file jusqu'à la reconnexion.
    return { state: 'unauthenticated', retryable: false, terminal: false, summaryId: null };
  }
  if (httpStatus === 409) {
    return { state: 'conflict', retryable: false, terminal: true, summaryId: null };
  }
  // 403 (refus RLS/PostgREST), 404/405/422 (déploiement, route basculée),
  // 408/429 (timeout, débit) : rien ne prouve que la réponse est définitive.
  // On préserve l'opération pour ne jamais jeter un bilan sur un incident
  // serveur ou une policy manquante.
  if (httpStatus >= 400 && httpStatus < 500) {
    return { state: 'failed', retryable: true, terminal: false, summaryId: null };
  }
  if (httpStatus >= 500) {
    return { state: 'failed', retryable: true, terminal: false, summaryId: null };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { state: 'failed', retryable: true, terminal: false, summaryId: null };
  }

  const body = payload as { status?: unknown; summaryId?: unknown };
  const summaryId = readSummaryId(body.summaryId);

  if (body.status === 'saved' || body.status === 'duplicate') {
    if (summaryId === 'invalid' || summaryId === null) {
      return { state: 'failed', retryable: true, terminal: false, summaryId: null };
    }
    return { state: 'saved', retryable: false, terminal: true, summaryId };
  }

  if (body.status === 'already_finished') {
    if (summaryId === 'invalid') {
      return { state: 'failed', retryable: true, terminal: false, summaryId: null };
    }
    // Séance close sans résumé retrouvé : ne jamais annoncer « enregistrée »
    // ni « aucun doublon » (il n'y a peut-être aucun bilan à montrer).
    return {
      state: summaryId === null ? 'already_finished_without_summary' : 'already_finished',
      retryable: false,
      terminal: true,
      summaryId,
    };
  }

  return { state: 'failed', retryable: true, terminal: false, summaryId: null };
}

/**
 * Une opération de fin doit rester dans la file tant que la réponse n'est pas
 * terminale. `unauthenticated` est volontairement conservé : il sera rejoué
 * après reconnexion, sans jamais perdre le bilan.
 */
export function shouldKeepFinishInQueue(outcome: FinishOutcome): boolean {
  return !outcome.terminal;
}
