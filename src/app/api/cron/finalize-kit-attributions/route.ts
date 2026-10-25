import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/finalize-kit-attributions
 * Job planifié (Lot 6.5) : pending → confirmed après le délai légal de
 * rétractation (14 jours), puis versement en CRÉDIT BOUTIQUE via
 * store_credit_ledger + reward_accounts.store_credit_cents.
 * Déclencheur EXTERNE : `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase.rpc('finalize_kit_attributions');
    if (error) throw error;
    return NextResponse.json({ credited: data ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur finalisation';
    console.error('❌ finalize-kit-attributions:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}