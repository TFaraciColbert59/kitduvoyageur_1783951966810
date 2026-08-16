import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rewards/withdraw
 * Demande un retrait d'argent réel (cash-out) de manière sécurisée et idempotente.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, payment_provider = 'bank_transfer', idempotency_key, metadata = {} } = body;

    if (!amount || amount <= 0 || !idempotency_key) {
      return NextResponse.json({ error: 'Paramètres de retrait invalides ou manquants' }, { status: 400 });
    }

    // Call stored procedure
    const { data: withdrawalId, error } = await supabase.rpc('request_withdrawal', {
      p_amount: amount,
      p_payment_provider: payment_provider,
      p_idempotency_key: idempotency_key,
      p_metadata: metadata
    });

    if (error) {
      console.warn('[rewards/withdraw] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, withdrawalId });
  } catch (err: any) {
    console.error('[rewards/withdraw] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
