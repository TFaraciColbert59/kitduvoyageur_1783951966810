/**
 * A10 (10.8) — Politique pure des requêtes de génération d'aventure.
 *
 * Décision unique et explicite par clé d'idempotence :
 *   • `reuse`       — clé déjà traitée (`done`) : réponse d'origine rejouée ;
 *   • `conflict`    — même clé en cours, autre génération active, ou clé
 *                     `done` sans plan persisté ;
 *   • `rate_limited`— quota horaire atteint (5/heure/utilisateur par défaut) ;
 *   • `proceed`     — nouvel appel autorisé.
 *
 * Aucune I/O, aucune lecture d'horloge : entièrement déterministe et testable.
 */

/** Quota par défaut : 5 générations par heure et par utilisateur. */
export const GENERATION_QUOTA_PER_HOUR = 5;

/** Fenêtre du quota (secondes) — également la valeur Retry-After. */
export const GENERATION_QUOTA_WINDOW_S = 3600;

/** Une seule génération active (pending) par utilisateur. */
export const GENERATION_MAX_ACTIVE = 1;

export type GenerationRequestStatus = 'pending' | 'done' | 'failed';

export interface ExistingGenerationRequest {
  status: GenerationRequestStatus;
  planId: string | null;
}

export interface EvaluateGenerationRequestInput {
  existing: ExistingGenerationRequest | null;
  /** Vrai si une AUTRE génération `pending` existe pour l'utilisateur. */
  activePending: boolean;
  /** Nombre de requêtes créées dans la fenêtre (1 h) pour l'utilisateur. */
  recentCount: number;
  quotaPerHour?: number;
}

export type GenerationDecision = 'reuse' | 'conflict' | 'rate_limited' | 'proceed';

export interface GenerationRequestEvaluation {
  decision: GenerationDecision;
  retryAfterS?: number;
  planId?: string;
}

function normalizedQuota(quotaPerHour: number | undefined): number {
  if (quotaPerHour == null || !Number.isFinite(quotaPerHour) || quotaPerHour < 1) {
    return GENERATION_QUOTA_PER_HOUR;
  }
  return Math.trunc(quotaPerHour);
}

/**
 * Évalue une demande : l'idempotence prime sur le quota (une clé `done` reste
 * réutilisable même si le quota a été consommé depuis), puis l'unicité active,
 * puis le quota.
 */
export function evaluateGenerationRequest(
  input: EvaluateGenerationRequestInput
): GenerationRequestEvaluation {
  const existing = input.existing;

  if (existing?.status === 'done') {
    return existing.planId
      ? { decision: 'reuse', planId: existing.planId }
      : { decision: 'conflict' };
  }

  if (existing?.status === 'pending') {
    return { decision: 'conflict' };
  }

  // `existing` absent ou `failed` : une génération peut être (re)tentée.
  if (input.activePending) {
    return { decision: 'conflict' };
  }

  const recentCount = Number.isFinite(input.recentCount)
    ? Math.max(0, Math.trunc(input.recentCount))
    : 0;
  if (recentCount >= normalizedQuota(input.quotaPerHour)) {
    return { decision: 'rate_limited', retryAfterS: GENERATION_QUOTA_WINDOW_S };
  }

  return { decision: 'proceed' };
}
