import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { parseRefundBody } from '@/features/loyalty/validation';
import { rpcRefund } from '@/features/loyalty/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/loyalty/refund — remboursement d'un article offert (montant repris
 * du journal par la RPC, jamais du client).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'loyalty-refund',
      limit: 20,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const parsed = parseRefundBody(await req.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const outcome = await rpcRefund(user.id, parsed.value);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({ success: true, ...outcome.data });
  } catch (err) {
    console.error('[loyalty/refund] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
