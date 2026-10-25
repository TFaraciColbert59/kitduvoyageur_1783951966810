import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/expire-live-positions
 * TRIBU-R6 : purge planifiée du partage de position live.
 *   1. supprime les positions expirées (TTL 15 min, re-vérifié à la suppression) ;
 *   2. ferme les sessions dont la fenêtre est dépassée.
 * Aucune suppression synchrone côté requête utilisateur.
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
    const nowIso = new Date().toISOString();

    const { data: deletedPositions, error: positionsError } = await supabase
      .from('group_live_positions')
      .delete()
      .lt('expires_at', nowIso)
      .select('session_id');
    if (positionsError) throw positionsError;

    const { data: closedSessions, error: sessionsError } = await supabase
      .from('group_live_sessions')
      .update({ stopped_at: nowIso })
      .is('stopped_at', null)
      .lt('expires_at', nowIso)
      .select('id');
    if (sessionsError) throw sessionsError;

    return NextResponse.json({
      positions: (deletedPositions ?? []).length,
      sessions: (closedSessions ?? []).length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur expiration positions live';
    console.error('[cron/expire-live-positions]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
