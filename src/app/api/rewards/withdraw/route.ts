import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rewards/withdraw
 * Demande un retrait d'argent réel (cash-out) de manière sécurisée et idempotente.
 */

const WithdrawSchema = z.object({
  // Montant en centimes, borné (1 € à 10 000 €) : jamais un flottant client.
  amount: z.number().int().min(100).max(1_000_000),
  payment_provider: z.enum(['bank_transfer', 'stripe']).default('bank_transfer'),
  idempotency_key: z.string().uuid(),
  metadata: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean()])).optional().default({}),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    // Phase 8 — cash-out : 5 demandes/heure, fail-closed (argent réel).
    const limited = await enforceRateLimit(user.id, {
      scope: 'rewards-withdraw',
      limit: 5,
      windowMs: 3_600_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const parsed = WithdrawSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Paramètres de retrait invalides ou manquants' }, { status: 400 });
    }
    const { amount, payment_provider, idempotency_key, metadata } = parsed.data;

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
