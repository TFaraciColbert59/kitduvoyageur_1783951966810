import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rewards/claim
 * Enregistre une contribution utilisateur et calcule les points associés.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = await req.json();
    const { action_type, target_id, target_type, metadata = {} } = body;

    if (!action_type || !target_id || !target_type) {
      return NextResponse.json({ error: 'Données de contribution incomplètes' }, { status: 400 });
    }

    // Call stored procedure
    const { data: contributionId, error } = await supabase.rpc('claim_reward_points', {
      p_user_id: user.id,
      p_action_type: action_type,
      p_target_id: target_id,
      p_target_type: target_type,
      p_metadata: metadata
    });

    if (error) {
      console.warn('[rewards/claim] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, contributionId });
  } catch (err: any) {
    console.error('[rewards/claim] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
