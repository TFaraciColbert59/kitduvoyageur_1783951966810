import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { predictSegment } from '@/features/adventure-intelligence/domain/prediction';
import {
  performanceProfileSchema,
  type PerformanceProfile,
} from '@/features/adventure-intelligence/schemas/performance.schema';
import {
  aggregateSegments,
  AGGREGATION_WINDOW_DAYS,
  type AggregateSegmentsClient,
  type ConsentGrant,
  type EligiblePassageRow,
  type ExpectedDuration,
} from '@/features/adventure-intelligence/server/aggregateSegments';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';

export const dynamic = 'force-dynamic';

/** Plafonds d'une exécution de cron (les lots suivants passent au prochain run). */
const SEGMENT_LIMIT = 200;
const PASSAGE_LIMIT = 5000;

interface SegmentRow {
  segment_id: number | string;
}

/** Heures UTC considérées comme nocturnes (approximation serveur). */
function isNightAt(iso: string): boolean {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return false;
  const hour = new Date(parsed).getUTCHours();
  return hour < 6 || hour >= 21;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Cron A4 — agrège les passages collectifs récents par segment.
 * Déclencheur externe avec `Authorization: Bearer ${CRON_SECRET}`.
 * La réponse ne contient que des compteurs agrégés, jamais d'identité.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const flags = await currentAdventureFeatureFlags();
  if (flags.collective_intelligence !== true) {
    return NextResponse.json({ skipped: 'flag_disabled' }, { status: 200 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }

  const { data: segmentRows, error: segmentsError } = await supabase.rpc(
    'a4_recent_eligible_segments',
    {
      p_since: `${AGGREGATION_WINDOW_DAYS} days`,
      p_limit: SEGMENT_LIMIT,
    }
  );
  if (segmentsError) {
    console.error('[adventure-intelligence/cron/a4] segments en échec:', segmentsError.message);
    return NextResponse.json({ error: 'Segments indisponibles' }, { status: 502 });
  }

  const segmentIds = ((segmentRows ?? []) as SegmentRow[])
    .map((row) => Number(row.segment_id))
    .filter((id) => Number.isFinite(id));

  const client: AggregateSegmentsClient = {
    async getEligiblePassages(segmentIdsToLoad: number[], sinceDays: number) {
      if (segmentIdsToLoad.length === 0) return [];
      const sinceIso = new Date(Date.now() - sinceDays * 86400000).toISOString();

      const { data, error } = await supabase
        .from('session_segment_passages')
        .select(
          'id, user_id, segment_id, direction, duration_s, distance_m, gain_m, loss_m, ' +
            'gps_quality, map_match_quality, uturn_detected, off_route, exited_at, ' +
            'session:hike_sessions!session_id(processing_status, track_quality, ended_at)'
        )
        .in('segment_id', segmentIdsToLoad)
        .eq('eligible_for_collective', true)
        .gte('exited_at', sinceIso)
        .order('exited_at', { ascending: false })
        .limit(PASSAGE_LIMIT);
      if (error) throw new Error(error.message);

      const { data: featureRows } = await supabase
        .from('trail_segment_features')
        .select('segment_id, surface')
        .in('segment_id', segmentIdsToLoad);
      const surfaceBySegment = new Map<number, string | null>(
        ((featureRows ?? []) as { segment_id: number | string; surface: string | null }[]).map(
          (row) => [Number(row.segment_id), row.surface ?? null]
        )
      );

      return ((data ?? []) as unknown as Record<string, unknown>[]).map(
        (raw): EligiblePassageRow => {
        const session = Array.isArray(raw.session)
          ? (raw.session[0] as Record<string, unknown> | undefined)
          : (raw.session as Record<string, unknown> | null | undefined);
        const trackQuality = (session?.track_quality ?? {}) as { plausibleMovement?: unknown };
        const plausibleMovement =
          typeof trackQuality.plausibleMovement === 'number'
            ? trackQuality.plausibleMovement >= 0.5
            : false;

        const gpsQuality = toFiniteNumber(raw.gps_quality);
        const mapMatchQuality = toFiniteNumber(raw.map_match_quality);
        const gainM = toFiniteNumber(raw.gain_m);
        const lossM = toFiniteNumber(raw.loss_m);
        const segmentId = Number(raw.segment_id);
        const exitedAt = String(raw.exited_at ?? '');

        return {
          passageId: String(raw.id),
          userId: String(raw.user_id),
          segmentId,
          direction: raw.direction === 'reverse' ? 'reverse' : 'forward',
          observedDurationS: toFiniteNumber(raw.duration_s) ?? 0,
          observedAt: exitedAt,
          gpsQuality,
          mapMatchQuality,
          passageQuality:
            gpsQuality !== null && mapMatchQuality !== null
              ? Math.min(gpsQuality, mapMatchQuality)
              : null,
          plausibleMovement,
          sessionFinished: session?.processing_status === 'processed' && session?.ended_at != null,
          uturnDetected: raw.uturn_detected === true,
          offRoute: raw.off_route === true,
          distanceM: toFiniteNumber(raw.distance_m) ?? 0,
          gainM,
          lossM,
          surface: surfaceBySegment.get(segmentId) ?? null,
          weather: null,
          isNight: isNightAt(exitedAt),
          isAscent: gainM !== null || lossM !== null ? (gainM ?? 0) > (lossM ?? 0) : null,
          packWeightKg: null,
        };
      });
    },

    async getConsents(userIds: string[]): Promise<ConsentGrant[]> {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('adventure_data_consents')
        .select('user_id, granted, revoked_at, policy_version')
        .eq('purpose', 'collective_terrain')
        .in('user_id', userIds);
      if (error) throw new Error(error.message);

      // A10 (10.7) — aligné sur `has_active_consent` : seule la dernière
      // policy_version compte, une ancienne ligne active ne suffit jamais (#25).
      const latestByUser = new Map<
        string,
        { policyVersion: string; granted: boolean; revokedAt: string | null }
      >();
      for (const raw of (data ?? []) as {
        user_id: string;
        policy_version: string;
        granted: boolean;
        revoked_at: string | null;
      }[]) {
        const current = latestByUser.get(raw.user_id);
        if (current === undefined || raw.policy_version > current.policyVersion) {
          latestByUser.set(raw.user_id, {
            policyVersion: raw.policy_version,
            granted: raw.granted,
            revokedAt: raw.revoked_at,
          });
        }
      }
      return userIds.map((userId) => {
        const latest = latestByUser.get(userId);
        return { userId, granted: latest?.granted === true && latest.revokedAt == null };
      });
    },

    async getExpectedDurations(passages: EligiblePassageRow[]): Promise<ExpectedDuration[]> {
      const userIds = [...new Set(passages.map((passage) => passage.userId))];
      const profiles = new Map<string, PerformanceProfile | null>();

      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from('user_performance_profiles')
          .select('*')
          .eq('activity_type', 'hiking')
          .in('user_id', userIds);
        if (error) {
          console.error(
            '[adventure-intelligence/cron/a4] profils indisponibles:',
            error.message
          );
        } else {
          for (const raw of (data ?? []) as Record<string, unknown>[]) {
            const parsed = performanceProfileSchema.safeParse({
              userId: raw.user_id,
              activityType: 'hiking',
              flatSpeedKmH: Number(raw.flat_speed_kmh),
              ascentSpeedMPerHour: Number(raw.ascent_speed_m_per_h ?? 0),
              descentSpeedMPerHour: Number(raw.descent_speed_m_per_h ?? 0),
              gradeResponse: raw.grade_response,
              surfaceResponse: raw.surface_response,
              fatigueCurve: raw.fatigue_curve,
              pauseModel: raw.pause_model,
              packResponse: raw.pack_response,
              confidence: raw.confidence,
              sampleCount: Number(raw.sample_count ?? 0),
              calibrationLevel: raw.calibration_level,
              modelVersion: raw.model_version,
              computedAt: raw.computed_at,
            });
            profiles.set(String(raw.user_id), parsed.success ? parsed.data : null);
          }
        }
      }

      return passages.map((passage): ExpectedDuration => {
        const profile = profiles.get(passage.userId) ?? null;
        try {
          const prediction = predictSegment(
            {
              segmentId: passage.segmentId,
              distanceM: passage.distanceM,
              gainM: passage.gainM ?? 0,
              lossM: passage.lossM ?? 0,
              surface: passage.surface ?? null,
              packWeightKg: passage.packWeightKg ?? null,
            },
            profile,
            profile?.confidence ?? null
          );
          return { passageId: passage.passageId, expectedDurationS: prediction.durationP50Seconds };
        } catch {
          // Profil illisible : repli générique sûr (allure standard), jamais d'échec du lot.
          const fallback = predictSegment(
            {
              segmentId: passage.segmentId,
              distanceM: passage.distanceM,
              gainM: passage.gainM ?? 0,
              lossM: passage.lossM ?? 0,
            },
            null,
            null
          );
          return { passageId: passage.passageId, expectedDurationS: fallback.durationP50Seconds };
        }
      });
    },

    async upsertAggregates(rows: unknown[]) {
      if (rows.length === 0) return;
      const { error } = await supabase.from('segment_collective_aggregates').upsert(rows, {
        onConflict: 'segment_id,condition_bucket,direction,processor_version',
      });
      if (error) throw new Error(error.message);
    },
  };

  const result = await aggregateSegments(segmentIds, client);

  return NextResponse.json({
    segments: result.segmentsProcessed,
    passages: result.passagesConsidered,
    aggregates: result.aggregatesWritten,
    suppressed: result.aggregatesSuppressed,
  });
}
