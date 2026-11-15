import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  detachActivityFromEvent,
  detectGroupActivities,
  matchActivityToClubEvent,
  type ActivityEventMatch,
} from '@/features/clubs';
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
import { loadEvent, loadEventRegistrations } from '../_lib/db';
import { asArray, type Row } from '../_lib/mappers';

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
