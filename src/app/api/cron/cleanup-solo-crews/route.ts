import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cleanup-solo-crews
 * Couche groupe universelle (H-ACT §4) : à la fin d'une activité, l'équipage
 * auto-créé resté solo (≤ 1 membre actif) est supprimé automatiquement.
 * Filet de sécurité du nettoyage synchrone de updateTripStatus (trips
 * terminés/annulés passés entre les mailles, rétentions, etc.).
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

    // 1. Équipages auto-créés
    const { data: autoCrews, error: crewsErr } = await supabase
      .from('crews')
      .select('id')
      .eq('auto_created', true);
    if (crewsErr) throw crewsErr;
    if (!autoCrews?.length) return NextResponse.json({ deleted: 0 });

    const crewIds = autoCrews.map((c) => (c as { id: string }).id);

    // 2. Comptage des membres actifs (une seule requête batch)
    const { data: members, error: membersErr } = await supabase
      .from('crew_members')
      .select('crew_id')
      .in('crew_id', crewIds)
      .eq('status', 'active');
    if (membersErr) throw membersErr;

    const countByCrew = new Map<string, number>();
    for (const m of (members ?? []) as Array<{ crew_id: string }>) {
      countByCrew.set(m.crew_id, (countByCrew.get(m.crew_id) ?? 0) + 1);
    }
    const soloIds = crewIds.filter((id) => (countByCrew.get(id) ?? 0) <= 1);
    if (!soloIds.length) return NextResponse.json({ deleted: 0 });

    // 3. Exclure les équipages rattachés à une activité non terminée
    const { data: unfinished, error: tripsErr } = await supabase
      .from('trips')
      .select('crew_id')
      .in('crew_id', soloIds)
      .not('status', 'in', '("completed","cancelled")');
    if (tripsErr) throw tripsErr;

    const busy = new Set(((unfinished ?? []) as Array<{ crew_id: string | null }>)
      .map((t) => t.crew_id)
      .filter((id): id is string => id != null));
    const deletable = soloIds.filter((id) => !busy.has(id));
    if (!deletable.length) return NextResponse.json({ deleted: 0 });

    // 4. Suppression (crew_members cascade côté base)
    const { error: deleteErr } = await supabase.from('crews').delete().in('id', deletable);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ deleted: deletable.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur nettoyage équipages';
    console.error('❌ cleanup-solo-crews:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
