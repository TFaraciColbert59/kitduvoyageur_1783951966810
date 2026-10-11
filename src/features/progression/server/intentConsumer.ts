import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import type { AwardProducerResult } from './awardProducer';
import { deriveVerifiedDiscoveriesFromSession } from './discoveries';
import {
  awardCarnetPublished,
  awardChecklistCompleted,
  awardHikeSessionProcessed,
  awardKitFieldReport,
  awardPlaceReview,
  awardTrailPrepared,
  awardTripCompleted,
} from './producerHooks';

/**
 * T07 — Consommateur borné des intentions durables.
 *
 * Chaque intention est réservée par une mise à jour conditionnelle
 * (`state in pending/failed` → `processing`) : deux workers concurrents ne
 * consomment jamais la même ligne. La preuve et le barème sont relus par le
 * serveur (producerHooks) ; le payload de l'intention ne contient qu'une
 * référence au fait. Une panne d'infrastructure repasse en `failed` avec
 * backoff puis `dead` après 5 tentatives ; un refus métier est terminal et
 * laisse la décision idempotente déjà écrite par le moteur.
 */

const MAX_ATTEMPTS = 5;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const INFRA_REASONS = new Set([
  'service_indisponible',
  'moteur_indisponible',
  'regles_indisponibles',
  'preuves_indisponibles',
  'hook_error',
]);

interface IntentRow {
  id: string;
  user_id: string;
  action_type: string;
  source_type: string;
  source_id: string;
  attempts: number;
  metadata: Record<string, unknown> | null;
}

export interface IntentConsumptionSummary {
  claimed: number;
  processed: number;
  refused: number;
  failed: number;
}

function parsePlaceReviewSource(sourceId: string): { userId: string; placeId: string } | null {
  const separator = sourceId.indexOf(':');
  if (separator <= 0 || separator === sourceId.length - 1) return null;
  return { userId: sourceId.slice(0, separator), placeId: sourceId.slice(separator + 1) };
}

async function dispatchIntent(intent: IntentRow): Promise<AwardProducerResult> {
  switch (intent.action_type) {
    case 'hike_session_processed':
      return awardHikeSessionProcessed(intent.source_id);
    case 'kit_field_report':
      return awardKitFieldReport(intent.source_id);
    case 'carnet_published':
      return awardCarnetPublished(intent.source_id);
    case 'checklist_completed':
      return awardChecklistCompleted(intent.source_id);
    case 'trip_completed':
      return awardTripCompleted(intent.source_id);
    case 'place_review': {
      const parsed = parsePlaceReviewSource(intent.source_id);
      if (!parsed) return { success: false, outcome: 'refused', reason: 'source_invalide' };
      return awardPlaceReview(parsed.userId, parsed.placeId);
    }
    case 'trail_prepared': {
      const routeId = intent.metadata?.routeId;
      const tripId = intent.metadata?.tripId;
      if (routeId === undefined || routeId === null || typeof tripId !== 'string') {
        return { success: false, outcome: 'refused', reason: 'source_invalide' };
      }
      return awardTrailPrepared(intent.user_id, String(routeId), tripId);
    }
    default:
      return { success: false, outcome: 'refused', reason: 'action_non_geree' };
  }
}

/**
 * Consomme un lot borné d'intentions. `userId` restreint le lot à un compte
 * (drain opportuniste depuis son propre parcours) ; sans filtre, le lot est
 * global (worker planifié). Ne lève jamais : la progression ne casse pas le
 * parcours appelant.
 */
export async function consumeProgressionAwardIntents(options?: {
  limit?: number;
  userId?: string;
}): Promise<IntentConsumptionSummary> {
  const summary: IntentConsumptionSummary = { claimed: 0, processed: 0, refused: 0, failed: 0 };
  const supabase = getServiceSupabase();
  if (!supabase) return summary;

  const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT));

  try {
    let query = supabase
      .from('progression_award_intents')
      .select('id, user_id, action_type, source_type, source_id, attempts, metadata')
      .in('state', ['pending', 'failed'])
      .lte('available_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(limit);
    if (options?.userId) query = query.eq('user_id', options.userId);

    const { data, error } = await query;
    if (error || !data) {
      if (error) console.error('[progression/intentConsumer] lecture en échec:', error.message);
      return summary;
    }

    for (const intent of data as IntentRow[]) {
      const attempts = intent.attempts + 1;
      const { data: claimedRows, error: claimError } = await supabase
        .from('progression_award_intents')
        .update({
          state: 'processing',
          claimed_at: new Date().toISOString(),
          attempts,
        })
        .eq('id', intent.id)
        .in('state', ['pending', 'failed'])
        .select('id');
      if (claimError) {
        console.error('[progression/intentConsumer] réservation en échec:', claimError.message);
        continue;
      }
      if (!claimedRows || claimedRows.length === 0) continue; // déjà consommée par un autre worker
      summary.claimed += 1;

      const result = await dispatchIntent(intent);

      if (result.success) {
        await supabase
          .from('progression_award_intents')
          .update({
            state: 'processed',
            resolved_at: new Date().toISOString(),
            last_error: null,
            reward_transaction_id: result.rewardTransactionId ?? null,
          })
          .eq('id', intent.id);

        // T18 — découvertes géographiques dérivées de la réalisation vérifiée.
        // Best-effort : l'échec n'affecte jamais l'attribution déjà écrite.
        if (intent.action_type === 'hike_session_processed') {
          try {
            await deriveVerifiedDiscoveriesFromSession(intent.source_id);
          } catch (error) {
            console.warn('[progression/intentConsumer] découvertes (non bloquant):', error);
          }
        }

        summary.processed += 1;
        continue;
      }

      const reason = result.reason ?? 'raison_inconnue';
      if (INFRA_REASONS.has(reason)) {
        const state = attempts >= MAX_ATTEMPTS ? 'dead' : 'failed';
        const backoffMinutes = Math.min(2 ** attempts, 64);
        await supabase
          .from('progression_award_intents')
          .update({
            state,
            last_error: reason,
            available_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
          })
          .eq('id', intent.id);
        summary.failed += 1;
        continue;
      }

      // Refus métier terminal : la décision idempotente est déjà écrite par le
      // moteur ; l'intention conserve la trace et ne sera pas rejouée.
      await supabase
        .from('progression_award_intents')
        .update({ state: 'refused', resolved_at: new Date().toISOString(), last_error: reason })
        .eq('id', intent.id);
      summary.refused += 1;
    }
  } catch (error) {
    console.error('[progression/intentConsumer] lot interrompu (non bloquant):', error);
  }

  return summary;
}
