import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain, type AwardProducerResult } from './awardProducer';

/**
 * P2 — Accroches des producteurs vérifiés.
 *
 * Chaque accroche lit les faits côté serveur (propriété, état final, comptages)
 * puis délègue au moteur canonique. Toute erreur est avalée : la progression ne
 * doit jamais casser le parcours métier, et l'idempotence empêche tout doublon.
 */

const SEGMENT_BONUS = 5;
const SEGMENT_BONUS_CAP = 110;
const KIT_ITEM_BONUS = 2;
const KIT_ITEM_BONUS_CAP = 20;

async function award(input: Parameters<typeof awardProducerGain>[0]): Promise<AwardProducerResult> {
  try {
    return await awardProducerGain(input);
  } catch (error) {
    console.error('[progression/producerHooks] échec non bloquant:', error);
    return { success: false, outcome: 'refused', reason: 'hook_error' };
  }
}

/** Session de randonnée traitée par le processeur → Explorer. */
export async function awardHikeSessionProcessed(sessionId: string): Promise<AwardProducerResult> {
  const supabase = getServiceSupabase();
  if (!supabase) return { success: false, outcome: 'refused', reason: 'service_indisponible' };

  const { data: session, error } = await supabase
    .from('hike_sessions')
    .select('user_id, ended_at, processing_status')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !session || session.processing_status !== 'processed') {
    return { success: false, outcome: 'refused', reason: 'session_non_traitee' };
  }

  const { count } = await supabase
    .from('session_segment_passages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  const segments = Math.max(0, count ?? 0);

  return award({
    userId: session.user_id,
    action: 'hike_session_processed',
    sourceType: 'hike_session',
    sourceId: sessionId,
    effectiveAt: session.ended_at ?? new Date().toISOString(),
    bonus: Math.min(segments * SEGMENT_BONUS, SEGMENT_BONUS_CAP),
    metadata: { segments },
  });
}

/** Activité réellement créée depuis un sentier → Se préparer. */
export async function awardTrailPrepared(
  userId: string,
  routeId: string | number,
  tripId: string
): Promise<AwardProducerResult> {
  return award({
    userId,
    action: 'trail_prepared',
    sourceType: 'trail_prep',
    sourceId: `${userId}:${routeId}`,
    effectiveAt: new Date().toISOString(),
    metadata: { routeId: String(routeId), tripId },
  });
}

/** Débrief terrain du kit (session traitée portant le kit) → Se préparer + Partager. */
export async function awardKitFieldReport(sessionId: string): Promise<AwardProducerResult> {
  const supabase = getServiceSupabase();
  if (!supabase) return { success: false, outcome: 'refused', reason: 'service_indisponible' };

  const { data: session, error } = await supabase
    .from('hike_sessions')
    .select('user_id, kit_id, processing_status')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !session || session.processing_status !== 'processed') {
    return { success: false, outcome: 'refused', reason: 'session_non_traitee' };
  }

  const { data: report, error: reportError } = await supabase
    .from('kit_field_reports')
    .select('kit_id')
    .eq('hike_session_id', sessionId)
    .limit(1)
    .maybeSingle();
  if (reportError || !report) {
    return { success: false, outcome: 'refused', reason: 'aucun_debrief' };
  }

  const { count } = await supabase
    .from('kit_field_reports')
    .select('id', { count: 'exact', head: true })
    .eq('hike_session_id', sessionId);
  const items = Math.max(1, count ?? 1);

  return award({
    userId: session.user_id,
    action: 'kit_field_report',
    sourceType: 'kit_report',
    sourceId: sessionId,
    effectiveAt: new Date().toISOString(),
    bonus: Math.min(items * KIT_ITEM_BONUS, KIT_ITEM_BONUS_CAP),
    metadata: { kitId: report.kit_id ?? session.kit_id, items },
  });
}

/** Avis de lieu publié (première publication uniquement) → Partager. */
export async function awardPlaceReview(
  userId: string,
  placeId: string
): Promise<AwardProducerResult> {
  return award({
    userId,
    action: 'place_review',
    sourceType: 'place_review',
    sourceId: placeId,
    effectiveAt: new Date().toISOString(),
  });
}
