import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { invalidateUserCache } from '@/lib/perf/userMemo';
import {
  mapProgressionGoalRow,
  mapProgressionGoalRows,
  type ProgressionGoal,
  type ProgressionGoalRow,
} from '@/features/compte/progression/goals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOAL_COLUMNS = 'id,period,sport,metric,target,created_at,updated_at';

const GoalBody = z
  .object({
    id: z.string().uuid().optional(),
    period: z.enum(['week', 'month', 'year']),
    sport: z.string().trim().min(1).max(64).nullable(),
    metric: z.enum(['distance_km', 'duration_s', 'elevation_gain_m', 'sessions']),
    target: z.number().finite().positive(),
  })
  .strict()
  .superRefine((goal, ctx) => {
    if (goal.metric === 'sessions' && !Number.isInteger(goal.target)) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'La cible en séances doit être un entier.',
      });
    }
    if (goal.target > 10_000_000) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'La cible est trop grande.',
      });
    }
  });

const GoalId = z.string().uuid();

function toApiGoal(goal: ProgressionGoal) {
  return {
    id: goal.id,
    period: goal.period,
    sport: goal.sport,
    metric: goal.metric,
    target: goal.target,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

/** Objectifs privés du propriétaire : aucune lecture inter-utilisateurs. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    const { data, error } = await auth.supabase
      .from('progression_goals')
      .select(GOAL_COLUMNS)
      .eq('user_id', auth.user.id)
      .order('period', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return fail('server', 'Impossible de charger tes objectifs.');
    return ok({
      goals: mapProgressionGoalRows((data ?? []) as ProgressionGoalRow[]).map(toApiGoal),
    });
  } catch {
    return fail('server', 'Impossible de charger tes objectifs.');
  }
}

/**
 * Crée ou met à jour un objectif. Sans identifiant, un objectif déjà présent
 * pour la même période, grandeur et sport voit sa cible mise à jour : la
 * création est donc idempotente et ne duplique pas la ligne.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = GoalBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Objectif invalide.');
  const body = parsed.data;
  const sport = body.sport === null ? null : body.sport.trim();

  if (sport) {
    const { data: knownSport, error: sportError } = await auth.supabase
      .from('explorer_sport_map')
      .select('sport')
      .eq('sport', sport)
      .maybeSingle();
    if (sportError) return fail('server', 'La taxonomie des sports est indisponible.');
    if (!knownSport) return fail('not_found', 'Sport inconnu.');
  }

  try {
    let targetId = body.id ?? null;
    if (targetId) {
      const { data: own, error } = await auth.supabase
        .from('progression_goals')
        .select('id')
        .eq('id', targetId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (error) return fail('server', 'La modification a échoué.');
      if (!own) return fail('not_found', 'Objectif introuvable.');
    } else {
      let existingQuery = auth.supabase
        .from('progression_goals')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('period', body.period)
        .eq('metric', body.metric);
      existingQuery =
        sport === null ? existingQuery.is('sport', null) : existingQuery.eq('sport', sport);
      const { data: existing, error } = await existingQuery.maybeSingle();
      if (error) return fail('server', 'La création a échoué.');
      targetId = existing?.id ?? null;
    }

    const values = {
      period: body.period,
      sport,
      metric: body.metric,
      target: body.target,
      updated_at: new Date().toISOString(),
    };

    const result = targetId
      ? await auth.supabase
          .from('progression_goals')
          .update(values)
          .eq('id', targetId)
          .eq('user_id', auth.user.id)
          .select(GOAL_COLUMNS)
          .single()
      : await auth.supabase
          .from('progression_goals')
          .insert({
            ...values,
            user_id: auth.user.id,
          })
          .select(GOAL_COLUMNS)
          .single();
    const { data: row, error } = result;
    if (error) {
      if (error.code === '23505') {
        return fail('conflict', 'Un objectif identique existe déjà.');
      }
      return fail('server', 'L’enregistrement de l’objectif a échoué.');
    }
    const goal = mapProgressionGoalRow(row as ProgressionGoalRow);
    if (!goal) return fail('server', 'L’objectif enregistré est illisible.');
    invalidateUserCache(auth.user.id);
    return ok({ goal: toApiGoal(goal) }, targetId ? 200 : 201);
  } catch {
    return fail('server', 'L’enregistrement de l’objectif a échoué.');
  }
}

/** Suppression par identifiant, bornée au propriétaire par la RLS. */
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = GoalId.safeParse(new URL(request.url).searchParams.get('id'));
  if (!id.success) return fail('not_found', 'Objectif introuvable.');
  try {
    const { data, error } = await auth.supabase
      .from('progression_goals')
      .delete()
      .eq('id', id.data)
      .eq('user_id', auth.user.id)
      .select('id')
      .maybeSingle();
    if (error) return fail('server', 'La suppression a échoué.');
    if (!data) return fail('not_found', 'Objectif introuvable.');
    invalidateUserCache(auth.user.id);
    return ok({ deleted: true, id: id.data });
  } catch {
    return fail('server', 'La suppression a échoué.');
  }
}

