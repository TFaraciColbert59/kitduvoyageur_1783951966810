import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluatePromotionRequestSchema,
  promoteModelRequestSchema,
  type EvaluatePromotionRequest,
  type PromoteModelRequest,
} from './promotionSchemas';

/**
 * Cycle de vie serveur `model_promotions` : evaluate -> promote.
 *
 * L'ecriture est filtreee par RLS (aucune policy d'ecriture pour
 * `authenticated`) ET par la fonction SQL elle-meme (`public.is_admin()` ou
 * `service_role`). Ce service passe par le client de session : il ne contourne
 * donc jamais ces garde-fous, il les transmet. Toute la validation est
 * repliquee cote TS (schemas) ET verifiee cote SQL (CHECK + RPC).
 *
 * Aucune valeur d'environnement, cle de service ou stack n'est renvoyee au
 * client : les erreurs sont normalisees en codes stables.
 */

export const PROMOTION_ERROR_CODES = {
  validation: 'promotion_validation_failed',
  forbidden: 'promotion_forbidden',
  conflict: 'promotion_conflict',
  unavailable: 'promotion_unavailable',
  unknown: 'promotion_unknown_error',
} as const;

export type PromotionErrorCode =
  (typeof PROMOTION_ERROR_CODES)[keyof typeof PROMOTION_ERROR_CODES];

export class PromotionError extends Error {
  readonly code: PromotionErrorCode;
  readonly retryable: boolean;

  constructor(code: PromotionErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'PromotionError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface PromotionOutcome {
  status: 'pending' | 'promoted';
  modelVersion: string;
  score: number;
  promoted: boolean;
}

interface RpcRow {
  status: string | null;
  model_version: string | null;
  score: number | string | null;
  promoted: boolean | null;
}

function toOutcome(row: RpcRow | undefined): PromotionOutcome {
  if (!row || row.status === null || row.model_version === null || row.score === null) {
    throw new PromotionError(
      PROMOTION_ERROR_CODES.unavailable,
      'Réponse de promotion inexploitable.',
      true
    );
  }
  const status = row.status === 'promoted' ? 'promoted' : 'pending';
  return {
    status,
    modelVersion: row.model_version,
    score: Number(row.score),
    promoted: status === 'promoted',
  };
}

/**
 * Mappe une erreur PostgREST/Postgres en code public. Le SQLSTATE porte la
 * verite (42501 forbidden, 22023 validation, 55000 conflit) ; le message
 * Postgres n'est jamais propage.
 */
function mapDatabaseError(error: { code?: string | null; message?: string | null }): PromotionError {
  const sqlState = error?.code ?? '';

  if (sqlState === '42501') {
    return new PromotionError(
      PROMOTION_ERROR_CODES.forbidden,
      'Promotion refusée : droits administrateur requis.'
    );
  }
  if (sqlState === '22023' || sqlState === '23514' || sqlState === '23502') {
    return new PromotionError(
      PROMOTION_ERROR_CODES.validation,
      'Promotion refusée : données invalides.'
    );
  }
  if (sqlState === '55000' || sqlState === '23505') {
    return new PromotionError(
      PROMOTION_ERROR_CODES.conflict,
      'Promotion refusée : état incompatible.'
    );
  }
  if (sqlState === 'PGRST116' || sqlState === '42883' || sqlState === '42P01') {
    return new PromotionError(
      PROMOTION_ERROR_CODES.unavailable,
      'Promotion indisponible : contrat base absent.',
      true
    );
  }
  return new PromotionError(
    PROMOTION_ERROR_CODES.unknown,
    'Promotion en échec.',
    true
  );
}

/**
 * Evalue une version de modele : validation Zod, puis RPC
 * `evaluate_model_promotion`. `promote: true` enchaîne la bascule dans la
 * meme transaction SQL (demote de la précédente, puis promotion).
 */
export async function evaluateModelPromotion(
  supabase: SupabaseClient,
  input: EvaluatePromotionRequest
): Promise<PromotionOutcome> {
  const parsed = evaluatePromotionRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new PromotionError(
      PROMOTION_ERROR_CODES.validation,
      'Requête de promotion invalide.'
    );
  }

  const { data, error } = await supabase.rpc('evaluate_model_promotion', {
    p_model_version: parsed.data.modelVersion,
    p_score: parsed.data.score,
    p_evidence: parsed.data.evidence,
    p_promote: parsed.data.promote,
  });

  if (error) throw mapDatabaseError(error);

  const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
  return toOutcome(row);
}

/**
 * Bascule une promotion `pending` vers `promoted`. La transaction SQL verrouille
 * l'invariant « un seul modele actif » ; un etat incompatible remonte en
 * `conflict` (409) plutot qu'un etat partiel.
 */
export async function promoteModelVersion(
  supabase: SupabaseClient,
  input: PromoteModelRequest
): Promise<PromotionOutcome> {
  const parsed = promoteModelRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new PromotionError(
      PROMOTION_ERROR_CODES.validation,
      'Requête de promotion invalide.'
    );
  }

  const { data, error } = await supabase.rpc('promote_model_version', {
    p_model_version: parsed.data.modelVersion,
  });

  if (error) throw mapDatabaseError(error);

  const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
  return toOutcome(row);
}

/** Lecture de la promotion active (lecture seule, RLS `authenticated`). */
export async function getActivePromotion(
  supabase: SupabaseClient
): Promise<PromotionOutcome | null> {
  const { data, error } = await supabase
    .from('model_promotions')
    .select('status, model_version, score')
    .eq('status', 'promoted')
    .order('promoted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw mapDatabaseError(error);
  if (!data) return null;
  return toOutcome(data as RpcRow);
}