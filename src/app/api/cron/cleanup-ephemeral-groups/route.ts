import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cleanup-ephemeral-groups
 * TRIBU-R6 : les groupes eclair (is_ephemeral) dont `auto_dissolve_at` est
 * depasse sont dissous par ce job planifie, jamais par une requete utilisateur.
 * La suppression du groupe cascade ses membres, taches, kit, caisse, etc.
 * Declencheur EXTERNE : `Authorization: Bearer ${CRON_SECRET}`.
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

    const { data: expired, error: selectError } = await supabase
      .from('travel_groups')
      .select('id')
      .eq('is_ephemeral', true)
      .lt('auto_dissolve_at', new Date().toISOString());
    if (selectError) throw selectError;

    const ids = ((expired ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const { error: deleteError } = await supabase
      .from('travel_groups')
      .delete()
      .in('id', ids)
      .eq('is_ephemeral', true)
      .lt('auto_dissolve_at', new Date().toISOString());
    if (deleteError) throw deleteError;

    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur nettoyage groupes eclair';
    console.error('[cron/cleanup-ephemeral-groups]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
