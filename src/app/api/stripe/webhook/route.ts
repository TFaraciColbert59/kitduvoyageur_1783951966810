import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { parseMetadataItems, StripeCartItemRef } from '@/features/checkout/stripeMetadata';
import { grantEntitlementsFromMetadata } from '@/lib/entitlements/server';
import {
  computeRoyaltyShares,
  MAX_ROYALTY_GENERATIONS,
  DEFAULT_ROYALTY_GLOBAL_BPS,
} from '@/features/kits/royalty';
import {
  classifyStripeEvent,
  extractEntitlementGrant,
  summarizeStripeEvent,
  type StripeEventLike,
} from '@/lib/stripe/events';
import {
  beginStripeEvent,
  markStripeEventProcessed,
  releaseStripeEvent,
} from '@/lib/stripe/eventStore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 * Webhook Stripe — création de la commande, des order_items, déstockage.
 *
 * PHASE 8 (durcissement) :
 * - Vérification de signature conservée (`constructEvent`, corps brut) ;
 * - Idempotence ÉVÉNEMENT : `public.stripe_events` réserve l'événement par son
 *   `id` (service_role). Un doublon est acquitté sans retraitement. En cas
 *   d'échec de traitement, la réservation est libérée pour laisser Stripe
 *   réessayer (jamais de perte silencieuse) ;
 * - Classification explicite : paiement (`checkout.session.completed`),
 *   renouvellement (`invoice.paid`/`payment_succeeded`), échec
 *   (`invoice.payment_failed`), remboursement (`charge.refunded`), annulation
 *   (`customer.subscription.deleted`). Les types non supportés sont acquittés
 *   (`ignored`) sans écriture métier.
 *
 * Idempotence métier conservée : `orders.stripe_session_id` (index UNIQUE).
 *
 * T38 — ENCAISSEMENT AUTORITAIRE : la carte est encaissée au checkout ;
 * `record_order_encashment_event` (service_role, idempotent par event_id) est
 * la SEULE source d'émission fidélité (10 crédits/€ marchandises) — les
 * triggers legacy d'émission-par-statut ont été retirés. Un échec de cet
 * encaissement fait échouer l'événement (réservation libérée, Stripe rejoue) :
 * jamais de perte silencieuse. Les remboursements émettent l'événement inverse
 * borné par ce qui a été réellement encaissé.
 */

interface CheckoutProcessingResult {
  duplicate: boolean;
}

/**
 * Encaissement fidélité (T38) — la preuve d'encaissement est la seule source
 * d'émission de crédits (10 crédits/€ de marchandises). Idempotent par
 * `stripe:<sessionId>` : un rejeu (retry Stripe ou chemin `duplicate`) ne
 * double jamais. Un échec PROPAGE : l'événement reste non traité (réservation
 * libérée) et Stripe rejouera — jamais de perte silencieuse.
 */
async function encashCardOrder(
  supabase: SupabaseClient,
  orderId: string,
  sessionId: string,
  merchandiseCents: number,
  buyerId: string | null
): Promise<void> {
  if (!buyerId || merchandiseCents <= 0) return;
  const { error } = await supabase.rpc('record_order_encashment_event', {
    p_event_id: `stripe:${sessionId}`,
    p_order_id: orderId,
    p_kind: 'payment',
    p_merchandise_cents: merchandiseCents,
  });
  if (error) {
    throw new Error(`encaissement fidélité refusé (${error.code ?? 'erreur'})`);
  }
}

/**
 * Traite `checkout.session.completed` : entitlements, commande, articles,
 * déstockage, part créateur. Retourne `duplicate: true` si la session a déjà
 * produit une commande (retry métier).
 */
async function processCheckoutSessionCompleted(
  stripe: Stripe,
  supabase: SupabaseClient,
  event: StripeEventLike
): Promise<CheckoutProcessingResult> {
  const session = event.data?.object;
  const sessionId = typeof session?.id === 'string' ? session.id : '';
  if (!sessionId) {
    throw new Error('checkout.session.completed sans identifiant de session');
  }

  // Retrieve with expanded line items (fallback uniquement)
  const expandedSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items'],
  });

  const userId = (expandedSession.metadata?.user_id as string) || null;
  const buyerId = userId && userId !== 'anonymous' ? userId : null;
  // Montant marchandises en centimes (hors livraison) — base d'émission.
  const merchandiseCents = Math.max(0, Math.round(Number(expandedSession.amount_subtotal || 0)));

  // Idempotence métier : un index UNIQUE stripe_session_id (les NULL restent permis)
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (existingOrder) {
    // Rejeu de session après incident : la commande existe déjà mais
    // l'encaissement a pu échouer — on le re-tente (idempotent), jamais les
    // autres effets (commande, stock, grants créés une seule fois).
    await encashCardOrder(supabase, existingOrder.id, sessionId, merchandiseCents, buyerId);
    return { duplicate: true };
  }

  // A13 (S3) — plan/pass éventuels portés par les métadonnées Stripe
  // existantes : grant d'entitlements best-effort, jamais bloquant (sans
  // plan/pass reconnu, aucune lecture ni écriture).
  if (userId && userId !== 'anonymous') {
    try {
      await grantEntitlementsFromMetadata(supabase, userId, expandedSession.metadata);
    } catch (grantError) {
      console.error('⚠️ Webhook: grant entitlements échoué', grantError);
    }
  }

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
    throw new Error(
      `création commande échouée: ${orderError?.message ?? 'Unknown database error'}`
    );
  }

  // Encaissement fidélité (T38) : preuve serveur du paiement carte — émet les
  // crédits (10 crédits/€ marchandises). Échec ⇒ événement non traité, Stripe
  // rejouera (chemin `duplicate` ci-dessus).
  await encashCardOrder(supabase, order.id, sessionId, merchandiseCents, buyerId);

  // ── order_items + déstockage (product_id depuis les items validés) ──
  const createdOrderItemIds: { productId: string; orderItemId: string; totalCents: number }[] = [];
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

    const { data: orderItemRow, error: itemError } = await supabase
      .from('order_items')
      .insert({
        order_id: order.id,
        product_id: item.id,
        product_slug: productSlug,
        product_name: productName,
        quantity: qty,
        unit_price_eur: unitPrice,
        total_price_eur: unitPrice * qty,
        transaction_type: 'achat',
      })
      .select('id')
      .single();
    if (itemError || !orderItemRow) {
      console.error(`❌ Webhook: order_items ${item.id}`, itemError);
      continue;
    }
    createdOrderItemIds.push({
      productId: item.id,
      orderItemId: orderItemRow.id,
      totalCents: Math.round(unitPrice * 100 * qty),
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

  // ── Part créateur (Lot 6) : attribution depuis metadata.kit_ref validé ──
  const kitRef = expandedSession.metadata?.kit_ref as string | undefined;
  if (kitRef && createdOrderItemIds.length > 0 && buyerId) {
    try {
      const { data: kitRow } = await supabase
        .from('materiel_kits')
        .select('user_id, ancestors')
        .eq('id', kitRef)
        .maybeSingle();
      if (kitRow) {
        const ancestors = (kitRow.ancestors as string[] | null) ?? [];
        const ancestorOwners = new Map<string, string>();
        if (ancestors.length > 0) {
          const { data: ancKits } = await supabase
            .from('materiel_kits')
            .select('id, user_id')
            .in('id', ancestors);
          for (const a of (ancKits ?? []) as { id: string; user_id: string }[]) {
            ancestorOwners.set(a.id, a.user_id);
          }
        }
        const gaps = [{ beneficiaryId: kitRow.user_id, generationGap: 0 }];
        for (const [idx, ancId] of ancestors.entries()) {
          const gap = ancestors.length - idx;
          if (gap >= MAX_ROYALTY_GENERATIONS) continue;
          const owner = ancestorOwners.get(ancId);
          if (owner) gaps.push({ beneficiaryId: owner, generationGap: gap });
        }
        const { data: cfgRow } = await supabase
          .from('royalty_config')
          .select('value')
          .eq('key', 'global')
          .maybeSingle();
        const rateBps =
          (cfgRow?.value as { global_bps?: number } | null)?.global_bps ??
          DEFAULT_ROYALTY_GLOBAL_BPS;

        for (const oi of createdOrderItemIds) {
          const commission = Math.floor((oi.totalCents * rateBps) / 10000);
          if (commission <= 0) continue;
          const { shares } = computeRoyaltyShares({
            commissionCents: commission,
            gaps,
            buyerId,
          });
          if (shares.length === 0) continue;
          await supabase.rpc('insert_kit_attribution', {
            p_kit_id: kitRef,
            p_order_item_id: oi.orderItemId,
            p_product_id: oi.productId,
            p_amount_cents: oi.totalCents,
            p_rate_bps: rateBps,
            p_shares: JSON.stringify(
              shares.map((s) => ({
                beneficiary_id: s.beneficiaryId,
                generation_gap: s.generationGap,
                share_cents: s.shareCents,
              }))
            ),
            p_buyer_user_id: buyerId,
          });
        }
      }
    } catch (attrErr) {
      console.error('⚠️ Webhook: attribution échouée', attrErr);
    }
  }

  return { duplicate: false };
}

/**
 * Renouvellement d'abonnement (`invoice.paid`) : accorde le grant porté par
 * les métadonnées serveur (`user_id` + plan/pass) si présent. Sans métadonnées
 * reconnues, aucune écriture (fail-safe, jamais un plan deviné).
 */
async function processSubscriptionRenewal(
  supabase: SupabaseClient,
  event: StripeEventLike
): Promise<void> {
  const grant = extractEntitlementGrant(event);
  if (!grant) return;
  await grantEntitlementsFromMetadata(supabase, grant.userId, grant.metadata);
}

/**
 * Remboursement (`charge.refunded`) : annule la commission créateur liée à la
 * session (best-effort) PUIS émet l'événement d'encaissement inverse (T38) —
 * borné par ce qui a été réellement encaissé et idempotent par événement.
 * L'échec de l'encaissement inverse propage (Stripe rejouera), jamais une
 * perte silencieuse de crédits déjà émis.
 */
async function processRefund(
  stripe: Stripe,
  supabase: SupabaseClient,
  event: StripeEventLike
): Promise<void> {
  const charge = event.data?.object as
    | { payment_intent?: string | null; amount_refunded?: number | null }
    | undefined;
  if (!charge?.payment_intent) return;

  let sessionId: string | undefined;
  try {
    const listed = await stripe.checkout.sessions.list({
      payment_intent: charge.payment_intent,
      limit: 1,
    });
    sessionId = listed.data[0]?.id;
  } catch (refundErr) {
    console.error('⚠️ Webhook: recherche session remboursement échouée', refundErr);
    return;
  }
  if (!sessionId) return;

  try {
    await supabase.rpc('reverse_kit_attribution_by_session', {
      p_stripe_session_id: sessionId,
    });
  } catch (refundErr) {
    console.error('⚠️ Webhook: reversement attribution échoué', refundErr);
  }

  // ── Encaissement inverse (T38) ──
  const { data: orderRow } = await supabase
    .from('orders')
    .select('id, user_id, payment_state, paid_merchandise_cents, refunded_merchandise_cents')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();
  if (!orderRow || !orderRow.user_id) return;

  const amountRefunded = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : 0;
  const alreadyRefunded = Number(orderRow.refunded_merchandise_cents ?? 0);
  const paidCents = Number(orderRow.paid_merchandise_cents ?? 0);
  const refundDeltaCents = Math.min(Math.max(0, amountRefunded - alreadyRefunded), paidCents);
  if (refundDeltaCents <= 0) return;

  const { error: encashError } = await supabase.rpc('record_order_encashment_event', {
    p_event_id: `stripe-refund:${event.id}`,
    p_order_id: orderRow.id,
    p_kind: 'refund',
    p_merchandise_cents: refundDeltaCents,
  });
  if (encashError) {
    throw new Error(`remboursement fidélité refusé (${encashError.code ?? 'erreur'})`);
  }
}

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

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_phase8_unset', {
    apiVersion: '2025-02-24.acacia' as const,
  });

  let event: StripeEventLike;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    ) as unknown as StripeEventLike;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signature invalide';
    console.error('❌ Webhook: signature invalide', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const summary = summarizeStripeEvent(event);

  // Idempotence événement : réservation service_role avant tout effet de bord.
  let firstDelivery: boolean;
  try {
    const begin = await beginStripeEvent(supabase, event);
    firstDelivery = begin.firstDelivery;
  } catch (beginError) {
    console.error('❌ Webhook: réservation idempotence impossible', beginError);
    return NextResponse.json({ error: 'Idempotence indisponible' }, { status: 500 });
  }

  if (!firstDelivery) {
    return NextResponse.json({ received: true, duplicate: true, eventId: summary.eventId });
  }

  try {
    const kind = classifyStripeEvent(event);
    switch (kind) {
      case 'checkout_completed': {
        const result = await processCheckoutSessionCompleted(stripe, supabase, event);
        if (result.duplicate) {
          await markStripeEventProcessed(supabase, summary.eventId);
          return NextResponse.json({ received: true, duplicate: true, eventId: summary.eventId });
        }
        break;
      }
      case 'subscription_renewed':
        await processSubscriptionRenewal(supabase, event);
        break;
      case 'refund':
        await processRefund(stripe, supabase, event);
        break;
      case 'payment_failed':
      case 'subscription_canceled':
      case 'ignored':
        // Aucun effet de bord : l'événement est journalisé puis acquitté.
        // Pas de révocation d'entitlement sans stockage d'abonnement vérifié.
        break;
    }

    await markStripeEventProcessed(supabase, summary.eventId);
    return NextResponse.json({ received: true, kind, eventId: summary.eventId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur webhook';
    console.error('❌ Webhook error:', message);
    // Libère la réservation : le retry Stripe pourra reprendre l'événement.
    await releaseStripeEvent(supabase, summary.eventId);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
