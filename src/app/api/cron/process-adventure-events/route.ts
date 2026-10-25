import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  processAdventureEvents,
  ADVENTURE_EVENT_CLAIM_LIMIT,
  type AdventureEventProcessingClient,
  type AdventureEventRow,
} from '@/features/adventure-intelligence/server/processAdventureEvents';

export const dynamic = 'force-dynamic';

/** Plafond de segments dont les agrégats sont invalidés par événement. */
const CONTRIBUTED_SEGMENT_LIMIT = 5000;

/**
 * Le cron quotidien (Hobby) ne tire qu'une fois par jour : un seul lot de 10
 * laisserait la file grossir. On enchaîne les lots tant que le précédent est
 * plein, dans une limite de lots et de temps (la tâche vit sous un délai de
 * 90 s dans le répartiteur ; un événement coupé en route est repris par le bail
 * de `claim_pending_adventure_events`, migration 20261012100000).
 */
const MAX_BATCHES = 20;
const BATCH_DEADLINE_MS = 60_000;

/**
 * Refus déterministes (événement forgé ou sans acteur) : les rejouer ne change
 * rien. Ils passent tout de suite à l'état terminal (attempts = 5) pour qu'une
 * rafale d'événements forgés, insérables par n'importe quelle session, ne
 * retarde pas la purge d'une vraie révocation.
 */
const TERMINAL_REFUSALS = new Set(['missing_actor_id', 'actor_mismatch']);
const MAX_ATTEMPTS = 5;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Cron A10 (10.7) — purge sur révocation de consentement.
 * Déclencheur externe avec `Authorization: Bearer ${CRON_SECRET}`.
 * Réclamation atomique via `claim_pending_adventure_events`, traitement
 * séquentiel, une erreur n'interrompt jamais le lot.
 *
 * La cible de purge est calculée côté `processAdventureEvents` à partir du seul
 * `actor_id` (jamais de `payload.userId`). Un échec repasse l'événement
 * `failed` avec son erreur : le claim le réclame de nouveau tant que
 * `attempts < 5`, puis il reste `failed` (état terminal).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }

  const service = supabase;
  /** Échecs non déterministes du lot en cours : on ne les rejoue pas dans la même exécution. */
  let transientFailures = 0;

  async function deleteByUser(table: string, userId: string): Promise<void> {
    const { error } = await service.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  const client: AdventureEventProcessingClient = {
    async claimPendingEvents(limit: number) {
      const { data, error } = await supabase.rpc('claim_pending_adventure_events', {
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdventureEventRow[];
    },

    async listContributedSegmentIds(userId: string) {
      const { data, error } = await supabase
        .from('session_segment_passages')
        .select('segment_id')
        .eq('user_id', userId)
        .limit(CONTRIBUTED_SEGMENT_LIMIT);
      if (error) throw new Error(error.message);
      return [
        ...new Set(
          ((data ?? []) as { segment_id: number | string }[]).map((row) => Number(row.segment_id))
        ),
      ].filter((id) => Number.isFinite(id));
    },

    deleteObservations: (userId) => deleteByUser('performance_observations', userId),
    deleteProfileVersions: (userId) => deleteByUser('user_performance_profile_versions', userId),
    deleteProfile: (userId) => deleteByUser('user_performance_profiles', userId),
    deleteSegmentPredictions: (userId) => deleteByUser('segment_predictions', userId),
    deleteRoutePredictions: (userId) => deleteByUser('route_predictions', userId),

    async deleteCollectiveAggregates(segmentIds: number[]) {
      if (segmentIds.length === 0) return;
      const { error } = await supabase
        .from('segment_collective_aggregates')
        .delete()
        .in('segment_id', segmentIds);
      if (error) throw new Error(error.message);
    },

    async markEventProcessed(eventId: string) {
      const { error } = await supabase
        .from('adventure_domain_events')
        .update({ status: 'processed', processed_at: new Date().toISOString(), error: null })
        .eq('id', eventId);
      if (error) throw new Error(error.message);
    },

    /**
     * Échec (ou refus) d'un événement : `failed` + `error` le rend réessayable
     * par le claim (attempts < 5) ; passé le cap, la ligne reste `failed`
     * (terminal, cf. migration 20260911250000).
     */
    async markEventFailed(eventId: string, failure: string) {
      console.warn('[adventure-intelligence/cron/events] événement en échec:', eventId, failure);
      const terminal = TERMINAL_REFUSALS.has(failure);
      if (!terminal) transientFailures += 1;
      const { error } = await supabase
        .from('adventure_domain_events')
        .update({
          status: 'failed',
          error: failure,
          processed_at: new Date().toISOString(),
          ...(terminal ? { attempts: MAX_ATTEMPTS } : {}),
        })
        .eq('id', eventId);
      if (error) console.error('[adventure-intelligence/cron/events] mark failed:', message(error));
    },
  };

  try {
    const startedAt = Date.now();
    const total = { processed: 0, failed: 0, skipped: 0 };
    let batches = 0;
    for (;;) {
      const failuresBefore = transientFailures;
      const result = await processAdventureEvents(client, { limit: ADVENTURE_EVENT_CLAIM_LIMIT });
      batches += 1;
      total.processed += result.processed;
      total.failed += result.failed;
      total.skipped += result.skipped;
      const handled = result.processed + result.failed + result.skipped;
      // Lot incomplet : la file est vide. Échec transitoire : on laisse au prochain tir.
      if (handled < ADVENTURE_EVENT_CLAIM_LIMIT || transientFailures > failuresBefore) break;
      if (batches >= MAX_BATCHES || Date.now() - startedAt >= BATCH_DEADLINE_MS) break;
    }
    return NextResponse.json({ ...total, batches });
  } catch (error) {
    console.error('[adventure-intelligence/cron/events] exécution en échec:', message(error));
    return NextResponse.json({ error: 'Traitement indisponible' }, { status: 502 });
  }
}
