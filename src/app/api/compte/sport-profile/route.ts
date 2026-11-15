import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  buildSportProfileSummary,
  mergeSportProfilePreferences,
  type SportAggregate,
  type SportProfileRecord,
} from '@/features/community/g01/sportProfile';
import { normalizeSport, type SportKey } from '@/features/community/g01/contracts';
import type { ViewerFacts } from '@/features/community/g01/visibilityPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PatchSchema = z
  .object({
    audience: z.enum(['private', 'abonnies', 'public']).optional(),
    sports: z.record(z.string(), z.boolean()).optional(),
    show_totals: z.boolean().optional(),
    show_records: z.boolean().optional(),
  })
  .strict();

interface RawSessionRow {
  id: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  duration_seconds: number | null;
  max_altitude_m: number | null;
  visibility: string | null;
  started_at: string | null;
  activity_session_id?: string | null;
}

async function computeAggregatesAndRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetUserId: string,
  includePrivate: boolean
): Promise<{ aggregates: SportAggregate[]; records: SportProfileRecord[] }> {
  let query = supabase
    .from('hike_sessions')
    .select('id,distance_km,elevation_gain_m,duration_seconds,max_altitude_m,visibility,started_at,activity_session_id')
    .eq('user_id', targetUserId)
    .order('started_at', { ascending: false })
    .limit(200);

  if (!includePrivate) {
    query = query.neq('visibility', 'private');
  }

  let { data: sessionsData, error } = await query;
  if (error?.code === '42703') {
    let fallbackQuery = supabase
      .from('hike_sessions')
      .select('id,distance_km,elevation_gain_m,duration_seconds,max_altitude_m,visibility,started_at')
      .eq('user_id', targetUserId)
      .order('started_at', { ascending: false })
      .limit(200);
    if (!includePrivate) {
      fallbackQuery = fallbackQuery.neq('visibility', 'private');
    }
    const fallback = await fallbackQuery;
    sessionsData = fallback.data as typeof sessionsData;
  }

  const sessions = (sessionsData ?? []) as RawSessionRow[];
  const activityIds = Array.from(
    new Set(
      sessions
        .map((s) => s.activity_session_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  const sportByActivity = new Map<string, SportKey>();
  if (activityIds.length > 0) {
    const { data: actRows } = await supabase
      .from('activity_sessions')
      .select('id,sport')
      .in('id', activityIds);
    for (const row of (actRows ?? []) as Array<{ id: string; sport?: string | null }>) {
      const normalized = normalizeSport(row.sport);
      if (normalized) sportByActivity.set(row.id, normalized);
    }
  }

  const bySport = new Map<
    SportKey,
    {
      sessions: number;
      distanceKm: number;
      elevationGainM: number;
      durationSeconds: number;
      bestDistance: { val: number; id: string; at: string | null } | null;
      bestElevation: { val: number; id: string; at: string | null } | null;
      bestAltitude: { val: number; id: string; at: string | null } | null;
      visibility: string | null;
    }
  >();

  for (const s of sessions) {
    const sport: SportKey =
      (s.activity_session_id ? sportByActivity.get(s.activity_session_id) : null) ?? 'rando';
    const entry = bySport.get(sport) ?? {
      sessions: 0,
      distanceKm: 0,
      elevationGainM: 0,
      durationSeconds: 0,
      bestDistance: null,
      bestElevation: null,
      bestAltitude: null,
      visibility: s.visibility ?? 'collective_anonymized',
    };
    entry.sessions += 1;
    const dist = typeof s.distance_km === 'number' && Number.isFinite(s.distance_km) && s.distance_km >= 0 ? s.distance_km : 0;
    const elev = typeof s.elevation_gain_m === 'number' && Number.isFinite(s.elevation_gain_m) && s.elevation_gain_m >= 0 ? s.elevation_gain_m : 0;
    const dur = typeof s.duration_seconds === 'number' && Number.isFinite(s.duration_seconds) && s.duration_seconds >= 0 ? s.duration_seconds : 0;
    const alt = typeof s.max_altitude_m === 'number' && Number.isFinite(s.max_altitude_m) && s.max_altitude_m >= 0 ? s.max_altitude_m : 0;

    entry.distanceKm += dist;
    entry.elevationGainM += elev;
    entry.durationSeconds += dur;

    if (dist > 0 && (!entry.bestDistance || dist > entry.bestDistance.val)) {
      entry.bestDistance = { val: dist, id: s.id, at: s.started_at };
    }
    if (elev > 0 && (!entry.bestElevation || elev > entry.bestElevation.val)) {
      entry.bestElevation = { val: elev, id: s.id, at: s.started_at };
    }
    if (alt > 0 && (!entry.bestAltitude || alt > entry.bestAltitude.val)) {
      entry.bestAltitude = { val: alt, id: s.id, at: s.started_at };
    }
    bySport.set(sport, entry);
  }

  const aggregates: SportAggregate[] = [];
  const records: SportProfileRecord[] = [];
  for (const [sport, entry] of bySport.entries()) {
    aggregates.push({
      sport,
      sessions: entry.sessions,
      distanceKm: Math.round(entry.distanceKm * 10) / 10,
      elevationGainM: Math.round(entry.elevationGainM),
      durationSeconds: Math.round(entry.durationSeconds),
    });
    if (entry.bestDistance) {
      records.push({
        id: `${entry.bestDistance.id}:distance`,
        sport,
        stat: 'distance',
        value: entry.bestDistance.val,
        visibility: entry.visibility,
        achievedAt: entry.bestDistance.at,
      });
    }
    if (entry.bestElevation) {
      records.push({
        id: `${entry.bestElevation.id}:elevation`,
        sport,
        stat: 'elevation',
        value: entry.bestElevation.val,
        visibility: entry.visibility,
        achievedAt: entry.bestElevation.at,
      });
    }
    if (entry.bestAltitude) {
      records.push({
        id: `${entry.bestAltitude.id}:altitude`,
        sport,
        stat: 'altitude',
        value: entry.bestAltitude.val,
        visibility: entry.visibility,
        achievedAt: entry.bestAltitude.at,
      });
    }
  }

  return { aggregates, records };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const requestedUserId = (searchParams.get('userId') ?? '').trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const targetUserId = requestedUserId || user?.id || '';
  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return fail('not_found', 'Profil introuvable.');
  }

  const isOwner = Boolean(user?.id && user.id === targetUserId);
  const { data: profileRow } = isOwner
    ? await supabase
        .from('user_profiles')
        .select('id,profile_visibility,sport_profile_prefs')
        .eq('id', targetUserId)
        .maybeSingle()
    : await supabase
        .from('public_profiles')
        .select('id,profile_visibility,sport_profile_prefs')
        .eq('id', targetUserId)
        .maybeSingle();

  if (!profileRow) {
    return ok({
      summary: buildSportProfileSummary({
        ownerId: targetUserId,
        viewer: { viewerId: user?.id ?? null, blocked: null },
        profileVisibility: 'prive',
        preferences: null,
      }),
    });
  }

  let viewer: ViewerFacts = { viewerId: user?.id ?? null };
  if (user?.id && !isOwner) {
    const [{ data: blockRows }, { data: followRow }] = await Promise.all([
      supabase
        .from('user_blocks')
        .select('blocker_id,blocked_id')
        .or(
          `and(blocker_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${user.id})`
        )
        .limit(1),
      supabase
        .from('user_follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle(),
    ]);
    viewer = {
      viewerId: user.id,
      blocked: Array.isArray(blockRows) && blockRows.length > 0,
      isFollower: Boolean(followRow),
    };
  }

  const { aggregates, records } = await computeAggregatesAndRecords(supabase, targetUserId, isOwner);
  const summary = buildSportProfileSummary({
    ownerId: targetUserId,
    viewer,
    profileVisibility: (profileRow as { profile_visibility?: unknown }).profile_visibility,
    preferences: (profileRow as { sport_profile_prefs?: unknown }).sport_profile_prefs,
    aggregates,
    records,
  });

  return ok({ summary });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('invalid', 'Préférences sportives invalides.');

  const { data: currentRow } = await auth.supabase
    .from('user_profiles')
    .select('profile_visibility,sport_profile_prefs')
    .eq('id', auth.user.id)
    .maybeSingle();

  const merged = mergeSportProfilePreferences(currentRow?.sport_profile_prefs, parsed.data);
  const { error } = await auth.supabase
    .from('user_profiles')
    .update({
      sport_profile_prefs: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.user.id);

  if (error) {
    return fail('server', 'Impossible d’enregistrer le profil sportif.');
  }

  const { aggregates, records } = await computeAggregatesAndRecords(auth.supabase, auth.user.id, true);
  const summary = buildSportProfileSummary({
    ownerId: auth.user.id,
    viewer: { viewerId: auth.user.id },
    profileVisibility: currentRow?.profile_visibility,
    preferences: merged,
    aggregates,
    records,
  });

  return ok({ preferences: merged, summary });
}
