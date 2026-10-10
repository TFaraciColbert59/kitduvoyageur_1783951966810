import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/orders/cancel — annulation d'une commande confirmée du membre.
 * Pas de RPC : le trigger commandes gère l'inversion des points.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'orders-cancel',
      limit: 20,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const body = (await req.json().catch(() => null)) as { orderId?: unknown } | null;
    const orderId = body?.orderId;
    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'invalid_order' }, { status: 400 });
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'service_indisponible' }, { status: 503 });
    }

    const { data, error } = await service
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .select('id');

    if (error) {
      console.error('[orders/cancel] update failed:', error.message);
      return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'not_cancellable' }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[orders/cancel] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
