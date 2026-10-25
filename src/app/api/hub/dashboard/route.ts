import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * H7.4 — KPI hub 7 jours, admin uniquement (garde `is_admin()`,
 * même convention que /api/admin/rewards).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
  if (adminError || !isAdmin) {
    return NextResponse.json({ error: 'Accès interdit : Administrateurs uniquement' }, { status: 403 });
  }

  const { data, error } = await supabase.from('hub_dashboard_kpis').select('*').single();
  if (error) return NextResponse.json({ error: 'KPI indisponibles' }, { status: 503 });
  return NextResponse.json(data);
}
