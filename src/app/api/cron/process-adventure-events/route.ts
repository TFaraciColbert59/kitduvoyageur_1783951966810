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

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Cron A10 (10.7) — purge sur révocation de consentement.
 * Déclencheur externe avec `Authorization: Bearer ${CRON_SECRET}`.
 * Réclamation atomique via `claim_pending_adventure_events`, traitement
 * séquentiel, une erreur n'interrompt jamais le lot.
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

    async markEventFailed(eventId: string, failure: string) {
      const { error } = await supabase
        .from('adventure_domain_events')
        .update({ status: 'failed', error: failure, processed_at: new Date().toISOString() })
        .eq('id', eventId);
      if (error) console.error('[adventure-intelligence/cron/events] mark failed:', message(error));
    },
  };

  try {
    const result = await processAdventureEvents(client, { limit: ADVENTURE_EVENT_CLAIM_LIMIT });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[adventure-intelligence/cron/events] exécution en échec:', message(error));
    return NextResponse.json({ error: 'Traitement indisponible' }, { status: 502 });
  }
}
