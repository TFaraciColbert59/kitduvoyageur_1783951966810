import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseMetadataItems, StripeCartItemRef } from '@/features/checkout/stripeMetadata';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 * Webhook Stripe — création de la commande, des order_items, déstockage.
 *
 * CORRECTION LOT 3 (chantier lignées) :
 * - Écritures avec le client SERVICE_ROLE (l'ancien client SSR anon + cookies
 *   était rejeté par la RLS `users_manage_own_orders` TO authenticated →
 *   AUCUNE commande n'était jamais créée).
 * - Idempotence par `orders.stripe_session_id` (index UNIQUE) au lieu du seul
 *   `notes`.
 * - Items depuis `metadata.user_id` + `metadata.items` (ou `checkout_intents`
 *   par `metadata.intent_id`) posées par /api/checkout — le fallback line_items
 *   sans id ne crée AUCUN order_items (l'ancien comportement).
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe webhook secret non configuré. Ajoutez STRIPE_WEBHOOK_SECRET.' },
      { status: 503 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Configuration Supabase service_role manquante' },
      { status: 503 }
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey);

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
      const sessionId = session.id as string;

      // Retrive with expanded line items (fallback uniquement)
      const expandedSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items'],
      });

      // Idempotence : un index UNIQUE stripe_session_id (les NULL restent permis)
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();

      if (existingOrder) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      // ── Attribution depuis les metadata posées par /api/checkout ──
      const userId = (expandedSession.metadata?.user_id as string) || null;

      let items: StripeCartItemRef[] = parseMetadataItems(
        expandedSession.metadata?.items as string | undefined
      );

      // Panier externalisé (dépassement limite 500) → checkout_intents
      if (items.length === 0 && expandedSession.metadata?.intent_id) {
        const { data: intent } = await supabase
          .from('checkout_intents')
          .select('payload')
          .eq('id', expandedSession.metadata.intent_id as string)
          .eq('status', 'pending')
          .maybeSingle();
        if (intent) {
          items = (intent.payload as StripeCartItemRef[]) ?? [];
          await supabase
            .from('checkout_intents')
            .update({ status: 'used' })
            .eq('id', expandedSession.metadata.intent_id as string);
        }
      }

      // Dernier recours : line_items Stripe (SANS id → ne créera aucun
      // order_items ; la commande reste tracée)
      if (items.length === 0 && expandedSession.line_items?.data) {
        items = expandedSession.line_items.data.map((li) => ({
          id: '',
          name: li.description || 'Produit',
          quantity: li.quantity || 1,
        }));
      }

      const orderNumber = `KDV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const shippingAddr = expandedSession.shipping_details?.address || {};
      const subtotalEur = ((expandedSession.amount_subtotal || 0) as number) / 100;
      const shippingEur = ((expandedSession.shipping_cost?.amount_total as number) || 0) / 100;
      const totalEur = ((expandedSession.amount_total || 0) as number) / 100;

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
          notes: `Stripe session: ${sessionId}`,
          stripe_session_id: sessionId,
        })
        .select('id')
        .single();

      if (orderError || !order) {
        console.error('❌ Webhook: création commande échouée', orderError);
        return NextResponse.json({ received: true, warning: 'Order creation failed' });
      }

      // ── order_items + déstockage (product_id depuis les items validés) ──
      for (const item of items) {
        if (!item.id) continue;

        const qty = item.quantity || 1;

        // Prix TOUJOURS côté serveur (products) — jamais la métadata client.
        let unitPrice = 0;
        let productName = item.name || '';
        let productSlug = '';
        const { data: productRow } = await supabase
          .from('products')
          .select('price_eur, name, slug')
          .eq('id', item.id)
          .maybeSingle();
        if (productRow && productRow.price_eur != null) {
          unitPrice = Number(productRow.price_eur);
          productName = productName || productRow.name || '';
          productSlug = productSlug || productRow.slug || '';
        }
        if (unitPrice <= 0) {
          unitPrice = Number(expandedSession.amount_total) / 100 / Math.max(1, items.length * qty);
        }

        const { error: itemError } = await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.id,
          product_slug: productSlug,
          product_name: productName,
          quantity: qty,
          unit_price_eur: unitPrice,
          total_price_eur: unitPrice * qty,
          transaction_type: 'achat',
        });
        if (itemError) {
          console.error(`❌ Webhook: order_items ${item.id}`, itemError);
          continue;
        }

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