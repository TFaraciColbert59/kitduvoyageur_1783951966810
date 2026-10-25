import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/refresh-atlas-density
 * Rafraîchit les vues matérialisées de densité de l'explorateur unifié
 * (country_centroids, country_trail_density, trail_density_geohash5).
 * Déclencheur EXTERNE : `Authorization: Bearer ${CRON_SECRET}`
 * (même convention que refresh-kit-scores). Jamais de calcul au rendu.
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
    const { error } = await supabase.rpc('refresh_atlas_density');
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur refresh densité ATLAS';
    console.error('❌ refresh-atlas-density:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
