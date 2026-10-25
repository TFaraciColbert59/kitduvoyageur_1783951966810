import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { goalBodySchema } from '@/features/rewards/validation';
import { setGoal } from '@/features/rewards/server/rewardsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function limit(userId: string) {
  return enforceRateLimit(userId, {
    scope: 'rewards-goal',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
}

/** PUT /api/rewards/goal — choisir un objectif (aucun point dépensé). */
export async function PUT(req: NextRequest) {
  try {
    const userId = await sessionUserId();
    if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    const limited = await limit(userId);
    if (limited) return limited;

    const parsed = goalBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

    const outcome = await setGoal(userId, parsed.data.rewardId);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ success: true, goal: outcome.data });
  } catch (err) {
    console.error('[rewards/goal] Erreur inattendue:', err instanceof Error ? err.name : 'inconnue');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/** DELETE /api/rewards/goal — retirer l'objectif (le solde ne bouge pas). */
export async function DELETE(_req: NextRequest) {
  try {
    const userId = await sessionUserId();
    if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    const limited = await limit(userId);
    if (limited) return limited;

    const outcome = await setGoal(userId, null);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ success: true, goal: null });
  } catch (err) {
    console.error('[rewards/goal] Erreur inattendue:', err instanceof Error ? err.name : 'inconnue');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
