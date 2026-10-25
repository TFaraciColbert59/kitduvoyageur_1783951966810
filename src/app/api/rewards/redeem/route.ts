import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { redeemBodySchema } from '@/features/rewards/validation';
import { redeem } from '@/features/rewards/server/rewardsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rewards/redeem — échange de points contre un objet financé.
 *
 * Réservation du stock et débit dans la même transaction SQL
 * (`rewards_redeem`) ; la clé d'idempotence fournie par le client rend une
 * nouvelle tentative inoffensive (même réservation, aucun second débit).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    // Ressource économique : fail-closed si le limiteur distribué est injoignable.
    const limited = await enforceRateLimit(user.id, {
      scope: 'rewards-redeem',
      limit: 10,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const parsed = redeemBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const outcome = await redeem(user.id, parsed.data.rewardId, parsed.data.idempotencyKey);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json({ success: true, ...outcome.data });
  } catch (err) {
    console.error('[rewards/redeem] Erreur inattendue:', err instanceof Error ? err.name : 'inconnue');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
