import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { parseEarnBody } from '@/features/loyalty/validation';
import { verifyEarnEligibility } from '@/features/loyalty/server';
import { awardPoints } from '@/features/rewards/server/rewardsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLOSED_CODES = new Set(['emission_closed', 'producer_closed', 'unknown_rule']);

/**
 * POST /api/loyalty/earn — gain lié à un rapport d'expédition (session vérifiée).
 *
 * Avant le chantier Récompenses, 75 crédits étaient versés sur la seule
 * existence d'un rapport (`legacy_loyalty_earn`). Le gain passe désormais par
 * `rewards_award_points` (règle `rapport_expedition`, décision unique par
 * rapport, plafonds hebdomadaires) et reste fermé tant que la configuration
 * `points_program` n'a ni cette règle ni son producteur ouverts.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'loyalty-earn',
      limit: 20,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const parsed = parseEarnBody(await req.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // La source doit exister côté serveur et appartenir au membre : le client
    // ne peut pas se créditer sur un identifiant inventé.
    const verified = await verifyEarnEligibility(user.id, parsed.value);
    if (!verified) {
      return NextResponse.json({ error: 'action_not_verified' }, { status: 403 });
    }

    const outcome = await awardPoints(user.id, parsed.value.action, 'kit_report', parsed.value.sourceId);
    if (!outcome.ok) {
      if (CLOSED_CODES.has(outcome.error)) {
        return NextResponse.json({ error: 'emission_closed' }, { status: 409 });
      }
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({ success: true, ...outcome.data });
  } catch (err) {
    console.error('[loyalty/earn] Unexpected error:', err instanceof Error ? err.name : 'inconnue');
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
