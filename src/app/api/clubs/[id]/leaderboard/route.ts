import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import {
  buildWeeklyClubLeaderboard,
  type ChallengeMetric,
  type ClubActivityInput,
} from '@/features/clubs';
import { dbFailure, errorJson, isUuid, json, optionalUser } from '../../_lib/http';
import { canReadClub, loadClubBundle } from '../../_lib/db';
import { asArray, asBoolean, asNumber, asString, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METRICS: readonly ChallengeMetric[] = [
  'distance_m',
  'duration_s',
  'elevation_gain_m',
  'activities_count',
];

function startOfWeekUtc(nowIso: string): Date {
  const date = new Date(nowIso);
  const day = date.getUTCDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
  return start;
}

function resolveWindow(weekStart: string | null, weekEnd: string | null): { start: string; end: string } {
  if (weekStart) {
    const start = new Date(weekStart);
    if (!Number.isNaN(start.getTime())) {
      const end = weekEnd ? new Date(weekEnd) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (!Number.isNaN(end.getTime()) && end > start) {
        return { start: start.toISOString(), end: end.toISOString() };
      }
    }
  }
  const start = startOfWeekUtc(new Date().toISOString());
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * GET /api/clubs/[id]/leaderboard — classement hebdomadaire S5.11.
 *
 * `buildWeeklyClubLeaderboard` est l’unique juge : il exclut les membres
 * bloqués S6.19, les opt-out P01 et les activités privées. La route ne fait
 * que projeter les activités de la semaine et transmettre le contexte.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const members = bundle.members;
    const params = request.nextUrl.searchParams;
    const metricParam = params.get('metric') as ChallengeMetric | null;
    const metric = metricParam && METRICS.includes(metricParam) ? metricParam : 'distance_m';
    const sport = params.get('sport')?.trim() || null;
    const window = resolveWindow(params.get('weekStart'), params.get('weekEnd'));

    const memberIds = members.filter((member) => member.status === 'active').map((member) => member.userId);
    let activityRows: Row[] = [];
    if (memberIds.length > 0) {
      const { data, error } = await supabase.rpc('lkdv_club_week_activities', {
        p_club: id,
        p_start: window.start,
        p_end: window.end,
      });
      if (error) return dbFailure('GET leaderboard activities', error);
      activityRows = asArray<Row>(data);
    }

    const activities: ClubActivityInput[] = activityRows.map((row) => {
      const distanceKm = asNumber(row.distance_km) ?? 0;
      return {
        id: String(row.id ?? ''),
        userId: String(row.user_id ?? ''),
        sport: asString(row.sport) ?? asString(row.activity) ?? bundle.club.primarySport,
        isIndoor: asBoolean(row.is_indoor),
        startsAt: String(row.started_at ?? ''),
        endsAt: String(row.ended_at ?? row.started_at ?? ''),
        distanceM: Math.max(0, Math.round(distanceKm * 1000)),
        durationS: asNumber(row.duration_seconds) ?? 0,
        elevationGainM: asNumber(row.elevation_gain_m) ?? 0,
        startLat: asNumber(row.start_lat),
        startLng: asNumber(row.start_lng),
        visibility: (asString(row.visibility) as ClubActivityInput['visibility']) ?? 'club_only',
        allowEventMatching: row.allow_event_matching !== false,
        allowGroupDetection: row.allow_group_detection !== false,
      };
    });

    const result = buildWeeklyClubLeaderboard({
      club: bundle.club,
      memberships: members,
      activities,
      viewerContext: bundle.viewerContext,
      weekStartIso: window.start,
      weekEndIso: window.end,
      sport,
      metric,
    });
    if (!result.ok) {
      const status = result.error === 'PRIVACY_RESTRICTED' || result.error === 'FORBIDDEN' ? 403 : 400;
      return errorJson(result.error, status, result.message);
    }

    return json({
      data: {
        leaderboard: result.data,
        sports: Array.from(new Set(members.flatMap((member) => member.verifiedSports ?? []))).sort(),
        viewerMembership: bundle.viewerMembership,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/leaderboard', error);
  }
}
