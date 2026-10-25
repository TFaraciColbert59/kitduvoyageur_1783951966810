import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getWallet } from '@/features/rewards/server/rewardsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/rewards/wallet — portefeuille de points du membre connecté :
 * solde du journal, attente, objectif, catalogue, historique. Propriétaire
 * uniquement (identité de session), jamais mis en cache partagé.
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'rewards-wallet',
      limit: 60,
      windowMs: 60_000,
      failMode: 'open',
    });
    if (limited) return limited;

    const outcome = await getWallet(user.id);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json(
      { snapshot: outcome.data.snapshot },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    console.error('[rewards/wallet] Erreur inattendue:', err instanceof Error ? err.name : 'inconnue');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
