import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  createSupabaseTerrainReportsClient,
  expireStaleReports,
} from '@/features/adventure-intelligence/server/terrainReports';

export const dynamic = 'force-dynamic';

/**
 * Cron A5 — expiration et vieillissement des signalements Terrain Live
 * (`expire` si `expires_at` dépassé, `age` si inactif depuis 24 h).
 * Déclencheur externe avec `Authorization: Bearer ${CRON_SECRET}`.
 * La réponse ne contient que des compteurs.
 */
export async function POST(request: NextRequest) {
  // Comparaison en temps constant (même helper que /api/cron/daily).
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }

  try {
    const result = await expireStaleReports(createSupabaseTerrainReportsClient(supabase));
    return NextResponse.json(result);
  } catch (err) {
    console.error(
      '[terrain/cron/expire] erreur inattendue:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: 'Expiration indisponible' }, { status: 502 });
  }
}
