import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getServiceSupabase } from '@/lib/ai/serviceClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/orders/confirm — confirmation d'une commande `pending`
 * (virement). Depuis T38, AUCUN trigger ne crédite : la confirmation admin
 * est la preuve que le virement a été réellement reçu, elle émet donc
 * l'événement d'encaissement `record_order_encashment_event` (idempotent par
 * commande, 10 crédits/€ de marchandises) AVANT la transition de statut —
 * un échec laisse la commande `pending` (réessayable) et n'émet rien.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
    if (adminError || !isAdmin) {
      return NextResponse.json({ error: 'Accès interdit : administrateurs uniquement' }, { status: 403 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'admin-orders-confirm',
      limit: 30,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const body = (await req.json().catch(() => null)) as { orderId?: unknown } | null;
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    // T38 — Encaissement autoritaire : preuve d'encaissement émise en premier
    // (idempotente par commande). Un échec ⇒ rien n'a changé, réessayable.
    const { data: orderRow } = await service
      .from('orders')
      .select('id, user_id, payment_method, subtotal_eur')
      .eq('id', orderId)
      .maybeSingle();

    if (
      orderRow &&
      orderRow.payment_method === 'virement' &&
      orderRow.user_id &&
      Number(orderRow.subtotal_eur) > 0
    ) {
      const { error: encashError } = await service.rpc('record_order_encashment_event', {
        p_event_id: `admin-transfer:${orderId}`,
        p_order_id: orderId,
        p_kind: 'payment',
        p_merchandise_cents: Math.round(Number(orderRow.subtotal_eur) * 100),
      });
      if (encashError) {
        console.error('[admin/orders/confirm] encaissement impossible', {
          code: encashError.code,
        });
        return NextResponse.json(
          { error: 'Encaissement non enregistré — réessayez' },
          { status: 500 }
        );
      }
    }

    const { data, error } = await service
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id');

    if (error) {
      console.error('[admin/orders/confirm] confirmation impossible', { code: error.code });
      return NextResponse.json({ error: 'Confirmation impossible' }, { status: 500 });
    }
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'not_confirmable' }, { status: 409 });
    }

    const res = NextResponse.json({ success: true });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[admin/orders/confirm] erreur inattendue', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
