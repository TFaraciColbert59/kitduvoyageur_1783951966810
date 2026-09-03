import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/refresh-kit-scores
 * Rafraîchit les vues matérialisées de conservation/confiance des lignées
 * (Lot 4). Déclencheur EXTERNE : `Authorization: Bearer ${CRON_SECRET}`
 * (même convention que refresh-country-guides et process-ai-jobs).
 * Ne jamais calculer ces agrégats au rendu.
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
    const { error } = await supabase.rpc('refresh_kit_conservation');
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur refresh scores';
    console.error('❌ refresh-kit-scores:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}