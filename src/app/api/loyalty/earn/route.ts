import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { parseEarnBody } from '@/features/loyalty/validation';
import { rpcEarn, verifyEarnEligibility } from '@/features/loyalty/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/loyalty/earn — gain de points à barème serveur (session vérifiée).
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

    const outcome = await rpcEarn(user.id, parsed.value);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({ success: true, ...outcome.data });
  } catch (err) {
    console.error('[loyalty/earn] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
