import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';

/**
 * P2 — Attribution serveur pour les producteurs vérifiés.
 *
 * Le client ne choisit jamais ni les points ni les compétences : cette couche
 * lit le barème versionné (`progression_rules.payload.actions`) et transmet la
 * décision au moteur canonique (`award_progression_gain`, service_role only).
 * Idempotente par construction : la clé `<source_type>:<source_id>` est stable.
 */

export type ProducerAction =
  | 'hike_session_processed'
  | 'trail_prepared'
  | 'kit_field_report'
  | 'place_review'
  | 'carnet_published'
  | 'checklist_completed'
  | 'trip_completed';

export interface AwardProducerInput {
  userId: string;
  action: ProducerAction;
  sourceType: string;
  sourceId: string;
  effectiveAt: string;
  /** Bonus additif calculé depuis des faits serveur (segments, items…). */
  bonus?: number;
  metadata?: Record<string, unknown>;
}

export interface AwardProducerResult {
  success: boolean;
  outcome: string;
  reason?: string | null;
  points?: number;
  rewardTransactionId?: string | null;
}

interface ActionRule {
  points?: number;
  max_points?: number;
  bonus_per_segment?: number;
  bonus_per_item?: number;
  weights?: Record<string, number>;
  caps?: Record<string, number>;
}

const SKILLS = ['explorer', 'preparer', 'partager', 'entraider'] as const;

function buildWeights(rule: ActionRule): Record<string, number> | null {
  const weights: Record<string, number> = {};
  let sum = 0;
  for (const skill of SKILLS) {
    const value = Number(rule.weights?.[skill] ?? 0);
    if (!Number.isFinite(value) || value < 0 || value > 1) return null;
    weights[skill] = value;
    sum += value;
  }
  if (Math.abs(sum - 1) > 0.0001) return null;
  return weights;
}

/**
 * Calcule le gain global (barème + bonus, plafonné) puis l'attribue.
 * Toute erreur d'infrastructure est avalée en `success:false` : un producteur
 * ne doit jamais échouer à cause de la progression (et jamais créditer deux fois).
 */
export async function awardProducerGain(input: AwardProducerInput): Promise<AwardProducerResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, outcome: 'refused', reason: 'service_indisponible' };
  }

  const { data: rules, error: rulesError } = await supabase
    .from('progression_rules')
    .select('payload')
    .eq('active', true)
    .maybeSingle();
  if (rulesError || !rules) {
    return { success: false, outcome: 'refused', reason: 'regles_indisponibles' };
  }

  const actions = (rules.payload as { actions?: Record<string, ActionRule> } | null)?.actions ?? {};
  const rule = actions[input.action];
  if (!rule || !Number.isFinite(Number(rule.points))) {
    return { success: false, outcome: 'refused', reason: 'action_non_autorisee' };
  }

  const weights = buildWeights(rule);
  if (!weights) {
    return { success: false, outcome: 'refused', reason: 'poids_invalides' };
  }

  const base = Number(rule.points);
  const bonus = Math.max(0, Math.floor(input.bonus ?? 0));
  const max = Number.isFinite(Number(rule.max_points)) ? Number(rule.max_points) : base;
  const points = Math.min(Math.max(base + bonus, 0), Math.max(max, base));

  const { data, error } = await supabase.rpc('award_progression_gain', {
    p_user_id: input.userId,
    p_action_type: input.action,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_effective_at: input.effectiveAt,
    p_points_total: points,
    p_weights: weights,
    p_explanation: `Gain validé · ${input.action}`,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    console.error('[progression/awardProducer] attribution en échec:', error.message);
    return { success: false, outcome: 'refused', reason: 'moteur_indisponible' };
  }

  const result = (data ?? {}) as {
    success?: boolean;
    outcome?: string;
    reason?: string;
    points?: number;
    rewardTransactionId?: string;
  };

  return {
    success: result.success === true,
    outcome: result.outcome ?? 'refused',
    reason: result.reason ?? null,
    points: result.points,
    rewardTransactionId: result.rewardTransactionId ?? null,
  };
}
