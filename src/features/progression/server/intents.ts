import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';

/**
 * T06 — Intention durable d'attribution.
 *
 * La plupart des transitions finales écrivent l'intention par capteur SQL,
 * dans la transaction de la source. Les flux sans transition de table
 * (préparation d'aventure depuis un sentier) appellent cette fonction dans
 * leur propre transaction serveur. L'écriture est idempotente par réalisation :
 * `(source_type, source_id)` est unique. Aucun montant ni poids dans l'intention.
 */

export interface EnqueueProgressionAwardIntentInput {
  userId: string;
  action:
    | 'hike_session_processed'
    | 'kit_field_report'
    | 'carnet_published'
    | 'checklist_completed'
    | 'trip_completed'
    | 'place_review'
    | 'trail_prepared';
  sourceType: string;
  sourceId: string;
  effectiveAt?: string;
  metadata?: Record<string, unknown>;
}

export async function enqueueProgressionAwardIntent(
  input: EnqueueProgressionAwardIntentInput
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('enqueue_progression_award_intent', {
    p_user_id: input.userId,
    p_action_type: input.action,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_business_effective_at: input.effectiveAt ?? new Date().toISOString(),
    p_metadata: input.metadata ?? {},
  });
  if (error) {
    console.error('[progression/intents] écriture d’intention en échec:', error.message);
    return false;
  }
  return data === true;
}
