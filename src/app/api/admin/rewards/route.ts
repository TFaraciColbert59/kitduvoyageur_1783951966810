import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rewards
 * Actions administratives pour le moteur de récompense.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if requester is admin
    const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_admin');
    if (adminCheckError || !isAdmin) {
      return NextResponse.json({ error: 'Accès interdit : Administrateurs uniquement' }, { status: 403 });
    }

    const body = await req.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action administrative manquante' }, { status: 400 });
    }

    if (action === 'finalize_period') {
      const { period_id, eligible_revenue } = params;
      if (!period_id || eligible_revenue == null) {
        return NextResponse.json({ error: 'Paramètres incorrects pour finaliser la période' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('finalize_reward_period', {
        p_period_id: period_id,
        p_eligible_revenue: eligible_revenue
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === 'process_withdrawal') {
      const { withdrawal_id, approve, reference = null, reason = null } = params;
      if (!withdrawal_id || approve == null) {
        return NextResponse.json({ error: 'Paramètres incorrects pour traiter le retrait' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('process_withdrawal', {
        p_withdrawal_id: withdrawal_id,
        p_approve: approve,
        p_reference: reference,
        p_reason: reason
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === 'process_contribution') {
      const { contribution_id, approve, reason = null } = params;
      if (!contribution_id || approve == null) {
        return NextResponse.json({ error: 'Paramètres incorrects pour traiter la contribution' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('process_pending_contribution', {
        p_contribution_id: contribution_id,
        p_approve: approve,
        p_reason: reason
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === 'update_config') {
      const { key, value, description = null } = params;
      if (!key || value == null) {
        return NextResponse.json({ error: 'Paramètres incorrects pour mettre à jour la configuration' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('reward_config')
        .upsert({
          key,
          value,
          description,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (err: any) {
    console.error('[admin/rewards] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
