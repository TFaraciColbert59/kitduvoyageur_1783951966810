import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Lot 09 — RGPD Article 20 (Droit à la portabilité) :
 * Exporte en 1 clic toutes les données d'activité Explorer de l'utilisateur authentifié
 * (sessions, zones EPZ, ledger matériel, consentements Art. 9).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const [sessionsRes, hikesRes, zonesRes, ledgerRes, consentsRes] = await Promise.all([
      supabase
        .from('activity_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(500),
      supabase
        .from('hike_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('user_privacy_zones').select('*').eq('user_id', user.id),
      supabase.from('gear_usage_ledger').select('*').eq('user_id', user.id).limit(1000),
      supabase.from('user_health_consents').select('*').eq('user_id', user.id),
    ]);

    const bundle = {
      schemaVersion: 'lkdv.explorer.rgpd.art20.v1',
      exportedAtIso: new Date().toISOString(),
      userId: user.id,
      activitySessions: sessionsRes.data ?? [],
      hikeSessions: hikesRes.data ?? [],
      privacyZones: zonesRes.data ?? [],
      gearUsageLedger: ledgerRes.data ?? [],
      healthConsents: consentsRes.data ?? [],
    };

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="lkdv-explorer-rgpd-export.json"',
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[explorer/v2/privacy/export-rgpd] unexpected error', err);
    return NextResponse.json({ error: 'RGPD export failed' }, { status: 500 });
  }
}
