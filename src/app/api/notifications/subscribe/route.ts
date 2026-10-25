import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/subscribe
 * Enregistre un abonnement Web Push pour l'utilisateur connecté.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    // Phase 8 — anti-spam d'abonnements : 20/min, fail-open.
    const limited = await enforceRateLimit(user.id, {
      scope: 'notifications-subscribe',
      limit: 20,
      windowMs: 60_000,
      failMode: 'open',
    });
    if (limited) return limited;

    const { subscription } = await req.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 });
    }

    // Insert or update subscription
    // To prevent duplicate endpoints for the same user, we search for existing first
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .filter('subscription->>endpoint', 'eq', subscription.endpoint)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({ subscription, created_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          subscription
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[notifications/subscribe] Error:', err.message || err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
