import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  processHikeSession,
  type GpsPoint,
  type HikeProcessingClient,
  type HikeSessionRow,
} from '@/features/adventure-intelligence/server/processHikeSession';
import type { SegmentCandidate } from '@/features/adventure-intelligence/domain/mapMatching';

export const dynamic = 'force-dynamic';

/** Taille du lot réclamé par exécution de cron. */
const CLAIM_LIMIT = 5;

interface CandidateRow {
  point_index: number | string;
  segment_id: number | string;
  distance_m: number | string;
  bearing_deg: number | string | null;
  highway: string | null;
  surface: string | null;
  sac_scale: string | null;
}

/**
 * Cron A2 — traite les sessions de randonnée `pending` hors trafic.
 * Déclencheur externe (GitHub Action / pg_cron + pg_net / Vercel Cron) avec
 * `Authorization: Bearer ${CRON_SECRET}`. Réclamation atomique via
 * `a2_claim_pending_sessions` (service_role), traitement séquentiel, les
 * erreurs d'une session n'interrompent pas le lot.
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

  const { data, error } = await supabase.rpc('a2_claim_pending_sessions', {
    p_limit: CLAIM_LIMIT,
  });
  if (error) {
    console.error('[adventure-intelligence/cron] claim en échec:', error.message);
    return NextResponse.json({ error: 'Claim indisponible' }, { status: 502 });
  }

  const sessions = (data ?? []) as HikeSessionRow[];

  const client: HikeProcessingClient = {
    async getSession(id: string) {
      const { data: row, error: sessionError } = await supabase
        .from('hike_sessions')
        .select(
          'id, user_id, positions_geojson, positions_timed, processing_status, processor_version, ended_at, processing_attempts'
        )
        .eq('id', id)
        .maybeSingle();
      if (sessionError) throw new Error(sessionError.message);
      return (row as HikeSessionRow | null) ?? null;
    },

    // A10 (10.6) : un seul appel PostGIS pour toute la trace échantillonnée.
    async getCandidatesBatch(points: GpsPoint[], radiusM: number): Promise<SegmentCandidate[][]> {
      if (points.length === 0) return [];
      const { data: rows, error: candidatesError } = await supabase.rpc(
        'a2_match_track_candidates',
        {
          p_points: points.map((point) => ({ lat: point.lat, lng: point.lng })),
          p_radius_m: radiusM,
        }
      );
      if (candidatesError) throw new Error(candidatesError.message);

      const results: SegmentCandidate[][] = points.map(() => []);
      for (const row of (rows ?? []) as CandidateRow[]) {
        const index = Number(row.point_index);
        if (!Number.isInteger(index) || index < 0 || index >= results.length) continue;
        results[index].push({
          segmentId: Number(row.segment_id),
          distanceM: Number(row.distance_m),
          bearingDeg: row.bearing_deg === null ? undefined : Number(row.bearing_deg),
          highway: row.highway,
          surface: row.surface,
          sacScale: row.sac_scale,
        });
      }
      return results;
    },

    async persistTranscript(input) {
      // A10 (10.4) : une seule RPC transactionnelle (passages + observations + session).
      const { error: persistError } = await supabase.rpc('persist_processed_hike_session', {
        p_session_id: input.sessionId,
        p_passages: input.passages,
        p_observations: input.observations,
        p_processor_version: input.processorVersion,
        p_track_quality: input.trackQuality,
      });
      if (persistError) throw new Error(persistError.message);
    },

    async markSession(id, patch) {
      const { error: markError } = await supabase.from('hike_sessions').update(patch).eq('id', id);
      if (markError) throw new Error(markError.message);
    },
  };

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      const result = await processHikeSession(session.id, client);
      if (result.status === 'processed') processed += 1;
      else if (result.status === 'skipped') skipped += 1;
      else failed += 1;
    } catch (err) {
      console.error(
        '[adventure-intelligence/cron] session en échec:',
        session.id,
        err instanceof Error ? err.message : err
      );
      failed += 1;
    }
  }

  return NextResponse.json({ processed, skipped, failed });
}
