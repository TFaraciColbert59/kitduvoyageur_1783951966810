import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  processHikeSession,
  type HikeProcessingClient,
  type HikeSessionRow,
} from '@/features/adventure-intelligence/server/processHikeSession';
import type { SegmentCandidate } from '@/features/adventure-intelligence/domain/mapMatching';

export const dynamic = 'force-dynamic';

/** Taille du lot réclamé par exécution de cron. */
const CLAIM_LIMIT = 5;

interface CandidateRow {
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
        .select('id, user_id, positions_geojson, processing_status, processor_version, ended_at')
        .eq('id', id)
        .maybeSingle();
      if (sessionError) throw new Error(sessionError.message);
      return (row as HikeSessionRow | null) ?? null;
    },

    async getCandidates(lat: number, lng: number, radiusM: number): Promise<SegmentCandidate[]> {
      const { data: rows, error: candidatesError } = await supabase.rpc('a2_segment_candidates', {
        p_lat: lat,
        p_lng: lng,
        p_radius_m: radiusM,
      });
      if (candidatesError) throw new Error(candidatesError.message);
      return ((rows ?? []) as CandidateRow[]).map((row) => ({
        segmentId: Number(row.segment_id),
        distanceM: Number(row.distance_m),
        bearingDeg: row.bearing_deg === null ? undefined : Number(row.bearing_deg),
        highway: row.highway,
        surface: row.surface,
        sacScale: row.sac_scale,
      }));
    },

    async upsertPassages(rows: unknown[]) {
      // Upsert (ON CONFLICT DO UPDATE via la clé d'idempotence) puis retour des
      // id persistés : indispensable pour relier chaque observation à son passage.
      const { data: persisted, error: upsertError } = await supabase
        .from('session_segment_passages')
        .upsert(rows, {
          onConflict: 'session_id,segment_id,direction,entered_at,processor_version',
        })
        .select('id, segment_id');
      if (upsertError) throw new Error(upsertError.message);
      return ((persisted ?? []) as { id: string; segment_id: number | string }[]).map((row) => ({
        id: row.id,
        segment_id: Number(row.segment_id),
      }));
    },

    async insertObservations(rows: unknown[]) {
      const { error: insertError } = await supabase.from('performance_observations').insert(rows);
      if (insertError) throw new Error(insertError.message);
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
