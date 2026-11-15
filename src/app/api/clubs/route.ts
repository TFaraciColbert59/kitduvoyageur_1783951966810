import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  createClubWithFounder,
  filterVisibleClubs,
  normalizeClubPrivacy,
  type Club,
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
} from './_lib/http';
import { asArray, asString, mapClubRow, type Row } from './_lib/mappers';
import { loadViewerContext } from './_lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createClubSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide'),
    description: z.string().trim().max(1000).default(''),
    primarySport: z.string().trim().min(2).max(40),
    sports: z.array(z.string().trim().min(2).max(40)).max(8).optional(),
    privacy: z.enum(['open', 'closed', 'secret', 'public', 'private', 'invite_only']).default('open'),
    zoneLabel: z.string().trim().max(120).nullish(),
    coverImage: z.string().url().max(2048).nullish(),
    rules: z.string().trim().max(1000).nullish(),
    joinQuestions: z.array(z.string().trim().min(1).max(160)).max(3).optional(),
  })
  .strict();

/**
 * GET /api/clubs — annuaire des clubs visibles pour le lecteur.
 *
 * `filterVisibleClubs` applique le contrat fail-closed : un club secret
 * n’apparaît jamais hors adhésion active, un club créé par un utilisateur
 * bloqué S6.19 est masqué. Aucun filtre SQL ne peut élargir cet ensemble.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const [{ context }, { data, error }] = await Promise.all([
      loadViewerContext(supabase, user?.id ?? null),
      supabase
        .from('clubs')
        .select('*')
        .order('members_count', { ascending: false })
        .limit(100),
    ]);
    if (error) return dbFailure('GET /api/clubs', error);

    const search = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
    const sport = request.nextUrl.searchParams.get('sport')?.trim().toLowerCase() ?? '';
    const privacy = request.nextUrl.searchParams.get('privacy')?.trim().toLowerCase() ?? '';

    let clubs = filterVisibleClubs(asArray<Row>(data).map(mapClubRow), context, [], {
      publicSearchOnly: !user,
    });
    if (search) {
      clubs = clubs.filter((club) =>
        `${club.name} ${club.description} ${club.primarySport} ${club.zoneLabel ?? ''}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (sport) {
      clubs = clubs.filter((club) =>
        club.sports.some((value) => value.toLowerCase() === sport),
      );
    }
    if (privacy) {
      const normalized = normalizeClubPrivacy(privacy);
      clubs = clubs.filter((club) => club.privacy === normalized);
    }

    return json({
      data: clubs,
      count: clubs.length,
      viewerId: user?.id ?? null,
    });
  } catch (error) {
    return dbFailure('GET /api/clubs', error);
  }
}

/**
 * POST /api/clubs — création d’un club et de son fondateur admin.
 *
 * `createClubWithFounder` produit le club et l’adhésion admin en une seule
 * décision ; la route persiste les deux lignes et compense le club si
 * l’adhésion fondatrice échoue.
 */
export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return csrfFailure();

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);
    if (!isUuid(user.id)) return errorJson('server_error', 500);

    const raw = await readJson(request);
    const parsed = createClubSchema.safeParse(raw);
    if (!parsed.success) {
      return errorJson('invalid_body', 400, parsed.error.flatten());
    }
    const input = parsed.data;

    const clubId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const profiles = await supabase
      .from('public_profiles')
      .select('id, full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    const profile = (profiles.data ?? null) as Row | null;

    const created = createClubWithFounder({
      id: clubId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      primarySport: input.primarySport,
      sports: input.sports,
      privacy: input.privacy,
      zoneLabel: input.zoneLabel ?? null,
      coverImage: input.coverImage ?? null,
      rules: input.rules ?? null,
      joinQuestions: input.joinQuestions ?? [],
      creatorUserId: user.id,
      creatorDisplayName: asString(profile?.full_name) ?? 'Fondateur',
      creatorAvatarUrl: asString(profile?.avatar_url),
      nowIso,
    });
    if (!created.ok) return respondClubResult(created);

    const { club, founderMember } = created.data;
    const { error: clubError } = await supabase.from('clubs').insert({
      id: club.id,
      slug: club.slug,
      name: club.name,
      description: club.description,
      category: club.primarySport,
      type: 'activité',
      privacy: club.privacy,
      location_label: club.zoneLabel,
      cover_image: club.coverImage,
      rules: club.rules,
      join_questions: club.joinQuestions,
      is_verified: false,
      created_by: user.id,
      members_count: 1,
    });
    if (clubError) return dbFailure('POST /api/clubs insert club', clubError);

    const { error: memberError } = await supabase.from('club_members').insert({
      club_id: club.id,
      user_id: user.id,
      role: founderMember.role,
      status: founderMember.status,
      joined_at: nowIso,
      leaderboard_opt_in: founderMember.leaderboardOptIn ?? true,
    });
    if (memberError) {
      const { error: cleanupError } = await supabase.from('clubs').delete().eq('id', club.id);
      if (cleanupError) console.error('[API clubs] compensation club échouée', cleanupError);
      return dbFailure('POST /api/clubs insert founder', memberError);
    }

    const mapped: Club = { ...club, createdBy: user.id, createdAt: nowIso };
    return json({ data: { club: mapped, founderMember } }, 201);
  } catch (error) {
    return dbFailure('POST /api/clubs', error);
  }
}
