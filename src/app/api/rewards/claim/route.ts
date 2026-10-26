import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rewards/claim
 * Enregistre une contribution utilisateur et calcule les points associés.
 */

const ClaimSchema = z.object({
  action_type: z.string().min(2).max(64),
  target_id: z.string().uuid(),
  target_type: z.enum(['hike', 'carnet', 'review', 'place', 'trail', 'contribution']),
  metadata: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()])).optional().default({}),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    // Phase 8 — points = ressource monétaire : fail-closed si le limiteur
    // distribué est configuré mais injoignable.
    const limited = await enforceRateLimit(user.id, {
      scope: 'rewards-claim',
      limit: 30,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const parsed = ClaimSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données de contribution invalides' }, { status: 400 });
    }
    const { action_type, target_id, target_type, metadata } = parsed.data;

    // Phase de stabilisation : la RPC d'attribution est service_role uniquement
    // (REVOKE authenticated). L'identité vient de la session vérifiée ci-dessus ;
    // le client ne fournit jamais points ni compétences.
    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }
    const { data: contributionId, error } = await service.rpc('claim_reward_points', {
      p_user_id: user.id,
      p_action_type: action_type,
      p_target_id: target_id,
      p_target_type: target_type,
      p_metadata: metadata
    });

    if (error) {
      console.warn('[rewards/claim] RPC error:', error.message);
      return NextResponse.json({ error: 'Contribution refusée' }, { status: 400 });
    }

    return NextResponse.json({ success: true, contributionId });
  } catch (err: any) {
    console.error('[rewards/claim] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
