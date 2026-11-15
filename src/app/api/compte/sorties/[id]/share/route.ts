import crypto from 'node:crypto';
import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  publishActivityShare,
  revokeActivityShare,
} from '@/features/community/g01/activityShareService';
import {
  isActivityShareActive,
  parseActivityShareMeta,
  type ActivityShareMeta,
} from '@/features/community/g01/activityShare';
import { normalizeSport } from '@/features/community/g01/contracts';
import type { SportSessionMetrics } from '@/features/community/g01/sportStats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ShareBodySchema = z
  .object({
    audience: z.enum(['public', 'abonnies', 'club']),
    clubId: z.string().uuid().nullable().optional(),
    allowLikes: z.boolean().optional(),
    allowComments: z.boolean().optional(),
    caption: z.string().max(500).nullable().optional(),
    requestId: z.string().uuid().optional(),
  })
  .strict();

interface OwnedSessionRow {
  id: string;
  user_id: string;
  title: string | null;
  started_at: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  elevation_gain_m: number | null;
  max_altitude_m: number | null;
  visibility: string | null;
  activity_session_id?: string | null;
}

async function loadOwnedSession(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
  outingId: string
): Promise<OwnedSessionRow | null> {
  let res = await supabase
    .from('hike_sessions')
    .select(
      'id,user_id,title,started_at,distance_km,duration_seconds,elevation_gain_m,max_altitude_m,visibility,activity_session_id'
    )
    .eq('id', outingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (res.error?.code === '42703') {
    res = await supabase
      .from('hike_sessions')
      .select('id,user_id,title,started_at,distance_km,duration_seconds,elevation_gain_m,max_altitude_m,visibility')
      .eq('id', outingId)
      .eq('user_id', userId)
      .maybeSingle();
  }
  return (res.data as OwnedSessionRow | null) ?? null;
}

async function loadLatestActiveShare(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
  outingId: string
): Promise<{ postId: string; meta: ActivityShareMeta } | null> {
  const { data } = await supabase
    .from('community_posts')
    .select('id,creation_meta')
    .eq('author_id', userId)
    .contains('creation_meta', { schema: 'lkdv.activity.share.v1', session_id: outingId })
    .order('created_at', { ascending: false })
    .limit(10);

  for (const row of (data ?? []) as Array<{ id: string; creation_meta?: unknown }>) {
    const meta = parseActivityShareMeta(row.creation_meta);
    if (meta && isActivityShareActive(meta)) {
      return { postId: row.id, meta };
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!id) return fail('not_found', 'Sortie introuvable.');

  const owned = await loadOwnedSession(auth.supabase, auth.user.id, id);
  if (!owned) return fail('not_found', 'Sortie introuvable.');

  const active = await loadLatestActiveShare(auth.supabase, auth.user.id, id);
  return ok({ share: active });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!id) return fail('not_found', 'Sortie introuvable.');

  const parsed = ShareBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail('bad_request', 'Paramètres de publication invalides.');
  }

  const owned = await loadOwnedSession(auth.supabase, auth.user.id, id);
  if (!owned) return fail('not_found', 'Sortie introuvable.');

  // Une sortie encore privée doit d'abord passer en `collective_anonymized`
  // pour rester cohérente avec le contrat C-PRIV entre `hike_sessions` et `community_posts`.
  if (owned.visibility !== 'collective_anonymized') {
    const { error: visError } = await auth.supabase
      .from('hike_sessions')
      .update({ visibility: 'collective_anonymized' })
      .eq('id', id)
      .eq('user_id', auth.user.id);
    if (visError) {
      return fail('server', 'Impossible d’ouvrir la visibilité de cette sortie.');
    }
    owned.visibility = 'collective_anonymized';
  }

  let sportRaw: string | null = null;
  if (owned.activity_session_id) {
    const { data: act } = await auth.supabase
      .from('activity_sessions')
      .select('sport')
      .eq('id', owned.activity_session_id)
      .maybeSingle();
    sportRaw = (act as { sport?: string | null } | null)?.sport ?? null;
  }

  const sessionMetrics: SportSessionMetrics = {
    id: owned.id,
    ownerId: auth.user.id,
    sport: normalizeSport(sportRaw) ?? 'rando',
    title: owned.title,
    startedAt: owned.started_at,
    distanceKm: owned.distance_km,
    durationSeconds: owned.duration_seconds,
    elevationGainM: owned.elevation_gain_m,
    maxAltitudeM: owned.max_altitude_m,
    visibility: owned.visibility,
    coverUrl: null,
  };

  // Si un partage actif existe déjà pour cette sortie avec la même requête ou précédente,
  // l'idempotence `requestId` évite les doublons ; sinon si l'auteur republie
  // avec une nouvelle audience, on révoque l'ancien partage actif avant d'insérer le nouveau.
  const existing = await loadLatestActiveShare(auth.supabase, auth.user.id, id);
  if (existing && !parsed.data.requestId) {
    await revokeActivityShare(auth.supabase, existing.postId, existing.meta);
  }

  const requestId = parsed.data.requestId ?? crypto.randomUUID();
  const result = await publishActivityShare(auth.supabase, sessionMetrics, {
    audience: parsed.data.audience,
    clubId: parsed.data.clubId ?? null,
    allowLikes: parsed.data.allowLikes ?? true,
    allowComments: parsed.data.allowComments ?? true,
    caption: parsed.data.caption ?? null,
    requestId,
  });

  if (!result.ok) {
    return fail('conflict', result.message);
  }

  return ok({ share: { postId: result.id, meta: result.meta, duplicate: result.duplicate } });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!id) return fail('not_found', 'Sortie introuvable.');

  const owned = await loadOwnedSession(auth.supabase, auth.user.id, id);
  if (!owned) return fail('not_found', 'Sortie introuvable.');

  const { data } = await auth.supabase
    .from('community_posts')
    .select('id,creation_meta')
    .eq('author_id', auth.user.id)
    .contains('creation_meta', { schema: 'lkdv.activity.share.v1', session_id: id })
    .order('created_at', { ascending: false })
    .limit(10);

  let revokedCount = 0;
  for (const row of (data ?? []) as Array<{ id: string; creation_meta?: unknown }>) {
    const meta = parseActivityShareMeta(row.creation_meta);
    if (!meta || !isActivityShareActive(meta)) continue;
    const res = await revokeActivityShare(auth.supabase, row.id, meta);
    if (res.ok) revokedCount += 1;
  }

  return ok({ revoked: revokedCount });
}
