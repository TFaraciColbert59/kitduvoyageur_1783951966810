import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  detachActivityFromEvent,
  detectGroupActivities,
  matchActivityToClubEvent,
  type ActivityEventMatch,
  type ClubActivityInput,
} from '@/features/clubs';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import {
  csrfFailure,
  dbFailure,
  errorJson,
  hasValidOrigin,
  isUuid,
  json,
  optionalUser,
  readJson,
  respondClubResult,
} from '../_lib/http';
import { loadEvent, loadEventRegistrations, loadViewerContext } from '../_lib/db';
import { asArray, asString, iso, type Row } from '../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const activitySchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().uuid(),
    sport: z.string().min(1),
    isIndoor: z.boolean(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    distanceM: z.number().min(0),
    durationS: z.number().min(0),
    elevationGainM: z.number().min(0),
    startLat: z.number().min(-90).max(90).nullish(),
    startLng: z.number().min(-180).max(180).nullish(),
    visibility: z.enum(['public', 'friends', 'club_only', 'private']),
    allowEventMatching: z.boolean().optional(),
    allowGroupDetection: z.boolean().optional(),
  })
  .strict();

const postSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('match'),
      eventId: z.string().uuid(),
      activity: activitySchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('detach'),
      matchId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal('group'),
      activities: z.array(activitySchema).max(200),
      minOverlapMinutes: z.number().int().min(1).max(600).optional(),
      maxOutdoorDistanceMeters: z.number().int().min(10).max(50_000).optional(),
    })
    .strict(),
]);

function mapMatchRow(row: Row): ActivityEventMatch {
  return {
    id: String(row.id ?? ''),
    activityId: String(row.activity_id ?? ''),
    eventId: String(row.event_id ?? ''),
    userId: String(row.user_id ?? ''),
    confidenceScore: typeof row.confidence_score === 'number' ? row.confidence_score : Number(row.confidence_score ?? 0),
    matchedAt: String(row.matched_at ?? ''),
    detachedAt: typeof row.detached_at === 'string' ? row.detached_at : null,
  };
}

function mapVisibility(raw: unknown): ClubActivityInput['visibility'] {
  if (raw === 'public' || raw === 'collective_anonymized') return 'public';
  if (raw === 'club_only' || raw === 'club') return 'club_only';
  if (raw === 'friends' || raw === 'abonnies' || raw === 'followers') return 'friends';
  return 'private';
}

function extractFirstCoord(geojson: unknown): { lat: number | null; lng: number | null } {
  if (!geojson || typeof geojson !== 'object') return { lat: null, lng: null };
  const record = geojson as { coordinates?: unknown; geometry?: { coordinates?: unknown } };
  const coords = Array.isArray(record.coordinates)
    ? record.coordinates
    : Array.isArray(record.geometry?.coordinates)
      ? record.geometry.coordinates
      : null;
  if (!coords || coords.length === 0) return { lat: null, lng: null };
  const first = Array.isArray(coords[0]) ? coords[0] : coords;
  if (!Array.isArray(first) || first.length < 2) return { lat: null, lng: null };
  const lng = typeof first[0] === 'number' ? first[0] : null;
  const lat = typeof first[1] === 'number' ? first[1] : null;
  return { lat, lng };
}

function mapHikeSessionToClubActivity(row: Row): ClubActivityInput | null {
  const id = asString(row.id);
  const userId = asString(row.user_id);
  if (!id || !userId) return null;
  const startedAt = iso(row.started_at);
  const durationS = typeof row.duration_seconds === 'number' && row.duration_seconds > 0
    ? row.duration_seconds
    : 0;
  const endedAt = row.ended_at
    ? iso(row.ended_at)
    : new Date(Date.parse(startedAt) + durationS * 1000).toISOString();
  const distanceKm = typeof row.distance_km === 'number' ? row.distance_km : Number(row.distance_km ?? 0);
  const elev = typeof row.elevation_gain_m === 'number' ? row.elevation_gain_m : Number(row.elevation_gain_m ?? 0);
  const { lat, lng } = extractFirstCoord(row.positions_geojson);
  return {
    id,
    userId,
    sport: asString(row.sport) ?? 'rando',
    isIndoor: false,
    startsAt: startedAt,
    endsAt: endedAt,
    distanceM: Number.isFinite(distanceKm) ? Math.max(0, Math.round(distanceKm * 1000)) : 0,
    durationS,
    elevationGainM: Number.isFinite(elev) ? Math.max(0, elev) : 0,
    startLat: lat,
    startLng: lng,
    visibility: mapVisibility(row.visibility),
  };
}

/** GET — appariements activité ↔ sortie & clusters de sorties en groupe (S5.17/S5.18). */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const clubIdParam = request.nextUrl.searchParams.get('clubId')?.trim() || null;
    const activityIdParam = request.nextUrl.searchParams.get('activityId')?.trim() || null;

    if (clubIdParam && !isUuid(clubIdParam)) {
      return errorJson('invalid_query', 400);
    }

    const { context } = await loadViewerContext(supabase, user.id);

    let eventIdsForClub: string[] = [];
    const eventsById: Record<string, { id: string; clubId: string; title: string; sport: string; startsAt: string }> = {};

    if (clubIdParam) {
      const { data: clubEvents, error: clubEventsErr } = await supabase
        .from('club_events')
        .select('id, club_id, title, sport, starts_at')
        .eq('club_id', clubIdParam)
        .limit(100);
      if (clubEventsErr) return dbFailure('GET matching club events', clubEventsErr);
      for (const row of asArray<Row>(clubEvents)) {
        const eid = asString(row.id);
        if (!eid) continue;
        eventIdsForClub.push(eid);
        eventsById[eid] = {
          id: eid,
          clubId: asString(row.club_id) ?? clubIdParam,
          title: asString(row.title) ?? 'Sortie club',
          sport: asString(row.sport) ?? 'rando',
          startsAt: iso(row.starts_at),
        };
      }
      if (eventIdsForClub.length === 0) {
        return json({ data: { matches: [], activities: [], clusters: [], eventsById: {}, memberNames: {} } });
      }
    }

    let matchQuery = supabase
      .from('club_activity_matches')
      .select('*')
      .order('matched_at', { ascending: false })
      .limit(100);
    if (activityIdParam) {
      matchQuery = matchQuery.eq('activity_id', activityIdParam).eq('user_id', user.id);
    } else if (clubIdParam) {
      matchQuery = matchQuery.in('event_id', eventIdsForClub);
    } else {
      matchQuery = matchQuery.eq('user_id', user.id);
    }

    const { data: matchRows, error: matchErr } = await matchQuery;
    if (matchErr) return dbFailure('GET matching rows', matchErr);
    const matches = asArray<Row>(matchRows).map(mapMatchRow);

    // Enrich missing event metadata when queried without clubId
    const missingEventIds = Array.from(new Set(matches.map((m) => m.eventId))).filter(
      (eid) => eid && !eventsById[eid],
    );
    if (missingEventIds.length > 0) {
      const { data: extraEvents } = await supabase
        .from('club_events')
        .select('id, club_id, title, sport, starts_at')
        .in('id', missingEventIds);
      for (const row of asArray<Row>(extraEvents)) {
        const eid = asString(row.id);
        if (!eid) continue;
        eventsById[eid] = {
          id: eid,
          clubId: asString(row.club_id) ?? '',
          title: asString(row.title) ?? 'Sortie club',
          sport: asString(row.sport) ?? 'rando',
          startsAt: iso(row.starts_at),
        };
      }
    }

    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
    let sessionsQuery = supabase
      .from('hike_sessions')
      .select('id, user_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, positions_geojson, visibility')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50);
    if (activityIdParam) {
      sessionsQuery = supabase
        .from('hike_sessions')
        .select('id, user_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, positions_geojson, visibility')
        .eq('id', activityIdParam)
        .eq('user_id', user.id)
        .limit(1);
    } else {
      sessionsQuery = sessionsQuery.gte('started_at', thirtyDaysAgoIso);
    }
    const { data: ownSessions } = await sessionsQuery;

    const activitiesMap = new Map<string, ClubActivityInput>();
    for (const row of asArray<Row>(ownSessions)) {
      const mapped = mapHikeSessionToClubActivity(row);
      if (mapped && mapped.visibility !== 'private') {
        activitiesMap.set(mapped.id, mapped);
      }
    }

    if (clubIdParam && context.viewerClubIds?.has(clubIdParam)) {
      const weekEndIso = new Date().toISOString();
      const { data: clubWeekRows } = await supabase.rpc('lkdv_club_week_activities', {
        p_club: clubIdParam,
        p_start: thirtyDaysAgoIso,
        p_end: weekEndIso,
      });
      for (const row of asArray<Row>(clubWeekRows)) {
        const id = asString(row.id);
        const uid = asString(row.user_id);
        if (!id || !uid || activitiesMap.has(id)) continue;
        const startedAt = iso(row.started_at);
        const durationS = typeof row.duration_seconds === 'number' ? row.duration_seconds : 0;
        const endedAt = row.ended_at
          ? iso(row.ended_at)
          : new Date(Date.parse(startedAt) + durationS * 1000).toISOString();
        const distKm = typeof row.distance_km === 'number' ? row.distance_km : Number(row.distance_km ?? 0);
        const elev = typeof row.elevation_gain_m === 'number' ? row.elevation_gain_m : Number(row.elevation_gain_m ?? 0);
        activitiesMap.set(id, {
          id,
          userId: uid,
          sport: 'rando',
          isIndoor: false,
          startsAt: startedAt,
          endsAt: endedAt,
          distanceM: Number.isFinite(distKm) ? Math.max(0, Math.round(distKm * 1000)) : 0,
          durationS,
          elevationGainM: Number.isFinite(elev) ? Math.max(0, elev) : 0,
          visibility: 'club_only',
        });
      }
    }

    const activities = Array.from(activitiesMap.values());
    const allClusters = detectGroupActivities({
      activities,
      blocks: context.blocks ?? [],
    });
    const clusters = activityIdParam
      ? allClusters.filter((c) => c.activityIds.includes(activityIdParam))
      : allClusters;

    const participantIds = Array.from(
      new Set([
        ...activities.map((a) => a.userId),
        ...matches.map((m) => m.userId),
        ...clusters.flatMap((c) => c.participantUserIds),
      ]),
    );
    const profiles = participantIds.length
      ? await fetchPublicProfilesWith(supabase, participantIds)
      : {};
    const memberNames: Record<string, string> = {};
    for (const [uid, profile] of Object.entries(profiles)) {
      if (profile && typeof profile === 'object') {
        const p = profile as { display_name?: string | null; username?: string | null };
        const label = p.display_name || p.username;
        if (label) memberNames[uid] = label;
      }
    }

    return json({
      data: {
        matches,
        activities,
        clusters,
        eventsById,
        memberNames,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/matching', error);
  }
}

/** POST — appariement activité ↔ sortie, retrait manuel, groupes S5.18. */
export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return csrfFailure();

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const parsed = postSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());
    const action = parsed.data;
    const nowIso = new Date().toISOString();

    if (action.action === 'group') {
      // Le contrat retire déjà les activités privées et les blocages S6.19.
      if (action.activities.some((activity) => activity.userId !== user.id)) {
        return errorJson('forbidden', 403);
      }
      return json({
        data: detectGroupActivities({
          activities: action.activities,
          minOverlapMinutes: action.minOverlapMinutes,
          maxOutdoorDistanceMeters: action.maxOutdoorDistanceMeters,
        }),
      });
    }

    if (action.action === 'detach') {
      const { data, error } = await supabase
        .from('club_activity_matches')
        .select('*')
        .eq('id', action.matchId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) return dbFailure('POST detach load', error);
      if (!data) return errorJson('not_found', 404);

      const detached = detachActivityFromEvent({
        match: mapMatchRow(data as Row),
        actorUserId: user.id,
        nowIso,
      });
      if (!detached.ok) return respondClubResult(detached);
      const { error: updateError } = await supabase
        .from('club_activity_matches')
        .update({ detached_at: nowIso })
        .eq('id', action.matchId)
        .eq('user_id', user.id);
      if (updateError) return dbFailure('POST detach', updateError);
      return json({ data: detached.data });
    }

    if (!isUuid(action.eventId)) return errorJson('invalid_body', 400);
    if (action.activity.userId !== user.id) return errorJson('forbidden', 403);

    const event = await loadEvent(supabase, action.eventId);
    if (!event) return errorJson('not_found', 404);
    const registrations = await loadEventRegistrations(supabase, action.eventId);
    const { data, error } = await supabase
      .from('club_activity_matches')
      .select('*')
      .eq('event_id', action.eventId)
      .eq('activity_id', action.activity.id)
      .limit(10);
    if (error) return dbFailure('POST match existing', error);
    const existing = asArray<Row>(data).map(mapMatchRow);

    const matched = matchActivityToClubEvent({
      matchId: crypto.randomUUID(),
      activity: action.activity,
      event,
      registrations,
      existingMatches: existing,
      nowIso,
    });
    if (!matched.ok) return respondClubResult(matched);

    const { error: upsertError } = await supabase.from('club_activity_matches').upsert(
      {
        id: matched.data.id,
        activity_id: matched.data.activityId,
        event_id: matched.data.eventId,
        user_id: user.id,
        confidence_score: matched.data.confidenceScore,
        matched_at: nowIso,
        detached_at: null,
      },
      { onConflict: 'activity_id,event_id' },
    );
    if (upsertError) return dbFailure('POST match', upsertError);
    return json({ data: matched.data }, 201);
  } catch (error) {
    return dbFailure('POST /api/clubs/matching', error);
  }
}
