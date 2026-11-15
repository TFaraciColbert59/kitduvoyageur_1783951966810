import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  computeClubChallengeSummary,
  createClubChallenge,
  joinChallenge,
  recordActivityInChallenge,
  type ChallengeMetric,
  type ClubActivityInput,
  type ClubChallenge,
  type ClubChallengeSummary,
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
} from '../../_lib/http';
import { canReadClub, isManager, loadClubBundle } from '../../_lib/db';
import { asArray, mapChallengeRow, mapProgressRow, type Row } from '../../_lib/mappers';

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
      action: z.literal('create'),
      scope: z.enum(['individual', 'club']),
      title: z.string().trim().min(2).max(120),
      description: z.string().trim().max(1000).default(''),
      sport: z.string().trim().max(40).nullish(),
      metric: z.enum(['distance_m', 'duration_s', 'elevation_gain_m', 'activities_count']),
      targetValue: z.number().positive(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      badgeTitle: z.string().trim().min(1).max(80),
      badgeIcon: z.string().trim().min(1).max(40),
    })
    .strict(),
  z.object({ action: z.literal('join'), challengeId: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal('record'),
      challengeId: z.string().uuid(),
      activity: activitySchema,
    })
    .strict(),
]);

async function loadChallenges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
): Promise<ClubChallenge[]> {
  const { data, error } = await supabase
    .from('club_challenges')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return asArray<Row>(data).map(mapChallengeRow);
}

async function loadProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeIds: string[],
) {
  if (challengeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('club_challenge_progress')
    .select('*')
    .in('challenge_id', challengeIds)
    .limit(2000);
  if (error) throw error;
  return asArray<Row>(data).map(mapProgressRow);
}

/** GET — défis du club et progression consolidée. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const challenges = await loadChallenges(supabase, id);
    const progress = await loadProgress(
      supabase,
      challenges.map((challenge) => challenge.id),
    );
    const nowIso = new Date().toISOString();
    const summaries: ClubChallengeSummary[] = challenges.map((challenge) =>
      computeClubChallengeSummary({ challenge, participants: progress, nowIso }),
    );

    return json({
      data: {
        summaries,
        challenges,
        progress,
        canCreate: isManager(bundle),
        viewerMembership: bundle.viewerMembership,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/challenges', error);
  }
}

/** POST — créer, rejoindre ou enregistrer une activité dans un défi. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const parsed = postSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);
    const nowIso = new Date().toISOString();
    const action = parsed.data;

    if (action.action === 'create') {
      const created = createClubChallenge({
        id: crypto.randomUUID(),
        clubId: id,
        scope: action.scope,
        title: action.title,
        description: action.description,
        sport: action.sport ?? null,
        metric: action.metric as ChallengeMetric,
        targetValue: action.targetValue,
        startsAt: action.startsAt,
        endsAt: action.endsAt,
        badgeTitle: action.badgeTitle,
        badgeIcon: action.badgeIcon,
        actorUserId: user.id,
        memberships: bundle.members,
      });
      if (!created.ok) return respondClubResult(created);

      const { error } = await supabase.from('club_challenges').insert({
        id: created.data.id,
        club_id: id,
        title: created.data.title,
        description: created.data.description,
        xp: Math.round(created.data.targetValue),
        deadline: created.data.endsAt,
        active: true,
        scope: created.data.scope,
        sport: created.data.sport,
        metric: created.data.metric,
        target_value: created.data.targetValue,
        starts_at: created.data.startsAt,
        ends_at: created.data.endsAt,
        badge_title: created.data.badgeTitle,
        badge_icon: created.data.badgeIcon,
        created_by: user.id,
      });
      if (error) return dbFailure('POST create challenge', error);
      return json({ data: created.data }, 201);
    }

    const { data: challengeRow, error: challengeError } = await supabase
      .from('club_challenges')
      .select('*')
      .eq('id', action.challengeId)
      .eq('club_id', id)
      .maybeSingle();
    if (challengeError) return dbFailure('POST challenge load', challengeError);
    if (!challengeRow) return errorJson('not_found', 404);
    const challenge = mapChallengeRow(challengeRow as Row);

    const { data: progressRows, error: progressError } = await supabase
      .from('club_challenge_progress')
      .select('*')
      .eq('challenge_id', action.challengeId)
      .limit(2000);
    if (progressError) return dbFailure('POST progress load', progressError);
    const progress = asArray<Row>(progressRows).map(mapProgressRow);

    if (action.action === 'join') {
      const joined = joinChallenge({
        challenge,
        userId: user.id,
        memberships: bundle.members,
        existingProgress: progress,
      });
      if (!joined.ok) return respondClubResult(joined);
      if (joined.data.currentValue === 0 && !progress.some((entry) => entry.userId === user.id)) {
        const { error } = await supabase.from('club_challenge_progress').insert({
          challenge_id: challenge.id,
          user_id: user.id,
          current_value: 0,
          recorded_activity_ids: [],
        });
        if (error) return dbFailure('POST join challenge', error);
      }
      return json({ data: joined.data }, 201);
    }

    const participant = progress.find(
      (entry) => entry.challengeId === challenge.id && entry.userId === user.id,
    );
    if (!participant) return errorJson('not_found', 404);

    const recorded = recordActivityInChallenge({
      challenge,
      participant,
      activity: action.activity as ClubActivityInput,
      nowIso,
    });
    if (!recorded.ok) return respondClubResult(recorded);

    const { error } = await supabase.from('club_challenge_progress').upsert(
      {
        challenge_id: challenge.id,
        user_id: user.id,
        current_value: recorded.data.currentValue,
        recorded_activity_ids: recorded.data.recordedActivityIds,
        completed_at: recorded.data.completedAt,
        badge_id: recorded.data.badge?.id ?? null,
        badge_title: recorded.data.badge?.title ?? null,
        badge_icon: recorded.data.badge?.icon ?? null,
        badge_awarded_at: recorded.data.badge?.awardedAt ?? null,
      },
      { onConflict: 'challenge_id,user_id' },
    );
    if (error) return dbFailure('POST record challenge', error);
    return json({ data: recorded.data });
  } catch (error) {
    return dbFailure('POST /api/clubs/[id]/challenges', error);
  }
}
