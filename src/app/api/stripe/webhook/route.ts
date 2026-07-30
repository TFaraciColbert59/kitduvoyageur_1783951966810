import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe webhook secret non configuré. Ajoutez STRIPE_WEBHOOK_SECRET.' },
      { status: 503 }
    );
  }

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia' as const,
    });

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as unknown as Record<string, unknown>;

      // Retrieve with expanded line items
      const expandedSession = await stripe.checkout.sessions.retrieve(
        session.id as string,
        { expand: ['line_items'] }
      );

      // Idempotency: skip if order already exists for this session
      const supabase = await createClient();
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('notes', `Stripe session: ${session.id}`)
        .maybeSingle();

      if (existingOrder) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      // Parse metadata
      const userId = (expandedSession.metadata?.user_id as string) || null;
      let items: { id?: string; slug?: string; name?: string; quantity?: number; priceEur?: number }[] = [];
      try {
        const raw = expandedSession.metadata?.items as string | undefined;
        if (raw) items = JSON.parse(raw);
      } catch {
        // fallback: build from Stripe line items
      }

      if (items.length === 0 && expandedSession.line_items?.data) {
        items = expandedSession.line_items.data.map((li) => ({
          name: li.description || 'Produit',
          quantity: li.quantity || 1,
          priceEur: li.amount_total ? li.amount_total / 100 / (li.quantity || 1) : 0,
        }));
      }

      const orderNumber = `KDV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Build shipping address
      const shippingAddr = expandedSession.shipping_details?.address || {};

      // Calculate totals
      const subtotalEur = ((expandedSession.amount_subtotal || 0) as number) / 100;
      const shippingEur = ((expandedSession.shipping_cost?.amount_total as number) || 0) / 100;
      const totalEur = ((expandedSession.amount_total || 0) as number) / 100;

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId && userId !== 'anonymous' ? userId : null,
          order_number: orderNumber,
          status: 'confirmed',
          payment_method: 'card',
          shipping_address: shippingAddr,
          items,
          subtotal_eur: subtotalEur,
          shipping_eur: shippingEur,
          total_eur: totalEur,
          notes: `Stripe session: ${session.id}`,
        })
        .select('id')
        .single();

      if (orderError || !order) {
        console.error('❌ Webhook: création commande échouée', orderError);
        return NextResponse.json({ received: true, warning: 'Order creation failed' });
      }

      // Create order_items and decrement stock
      for (const item of items) {
        if (!item.id) continue;

        const unitPrice = item.priceEur || 0;
        const qty = item.quantity || 1;

        await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.id,
          product_slug: item.slug || '',
          product_name: item.name || '',
          quantity: qty,
          unit_price_eur: unitPrice,
          total_price_eur: unitPrice * qty,
          transaction_type: 'achat',
        });

        try {
          await supabase.rpc('decrement_stock_on_order', {
            p_product_id: item.id,
            p_quantity: qty,
            p_order_id: order.id,
            p_user_id: userId && userId !== 'anonymous' ? userId : null,
          });
        } catch (stockErr) {
          console.error(`⚠️ Webhook: échec déstockage ${item.id}`, stockErr);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur webhook';
    console.error('❌ Webhook error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
