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
 *   `id` (service_role). Les événements traités sont acquittés. Le checkout
 *   reprend une réservation processing sous verrou transactionnel ; les
 *   autres handlers libèrent leur réservation après exception ;
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
 * encaissement fait échouer l'événement (réservation conservée, Stripe rejoue) :
 * jamais de perte silencieuse. Les remboursements émettent l'événement inverse
 * borné par ce qui a été réellement encaissé.
 */

interface CheckoutProcessingResult {
  duplicate: boolean;
}

/** Resume every required effect; an existing order is not proof of completion. */
async function processCheckoutSessionCompleted(
  stripe: Stripe,
  supabase: SupabaseClient,
  event: StripeEventLike
): Promise<CheckoutProcessingResult> {
  const sessionId = typeof event.data?.object?.id === 'string' ? event.data.object.id : '';
  if (!sessionId) throw new Error('checkout.session.completed sans identifiant de session');
  const expandedSession = await stripe.checkout.sessions.retrieve(sessionId);
  const userId = expandedSession.metadata?.user_id || null;
  const buyerId = userId && userId !== 'anonymous' ? userId : null;
  let items: StripeCartItemRef[] = parseMetadataItems(expandedSession.metadata?.items);
  const intentId = expandedSession.metadata?.intent_id;
  if (items.length === 0 && intentId) {
    const { data, error } = await supabase.from('checkout_intents').select('payload')
      .eq('id', intentId).maybeSingle();
    if (error) throw new Error('lecture du panier de paiement impossible');
    if (Array.isArray(data?.payload)) items = data.payload as StripeCartItemRef[];
  }

  // Stripe is the price source. Catalog prices may have changed since payment.
  // Explicit product metadata maps new sessions; legacy sessions retain their
  // server-created descriptions and quantities only when the mapping is unique.
  const paidLines: Stripe.LineItem[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100, expand: ['data.price.product'], ...(after ? { starting_after: after } : {}),
    });
    paidLines.push(...page.data);
    if (!page.has_more) break;
    const last = page.data.at(-1)?.id;
    if (!last || last === after) throw new Error('pagination Stripe sans progression');
    after = last;
  }
  const validLegacyItems = items.every((item) => item && typeof item.id === 'string' &&
    item.id.length > 0 && typeof item.name === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0);
  let usedLegacyMapping = false;
  const lines = paidLines.map((line) => {
    const product = line.price?.product;
    const mappedId = product && typeof product === 'object' && !product.deleted
      ? product.metadata?.product_id : undefined;
    let productId = mappedId || '';
    if (!productId && validLegacyItems) {
      const candidates = new Set(items.filter((item) => item.name === line.description &&
        item.quantity === line.quantity).map((item) => item.id));
      if (candidates.size === 1) {
        productId = [...candidates][0];
        usedLegacyMapping = true;
      }
    }
    if (!productId || !Number.isSafeInteger(line.quantity) || (line.quantity ?? 0) <= 0 ||
        !Number.isSafeInteger(line.amount_total) || line.amount_total < 0) {
      throw new Error('ligne de paiement non réconciliable');
    }
    return { product_id: productId, quantity: line.quantity!, total_cents: line.amount_total };
  });
  if (usedLegacyMapping) {
    const expected = new Map<string, number>();
    const actual = new Map<string, number>();
    for (const item of items) expected.set(item.id, (expected.get(item.id) || 0) + item.quantity);
    for (const line of lines) actual.set(line.product_id, (actual.get(line.product_id) || 0) + line.quantity);
    if (expected.size !== actual.size || [...expected].some(([id, quantity]) => actual.get(id) !== quantity)) {
      throw new Error('panier historique non réconciliable');
    }
  }
  // Empty line lists are accepted only for metadata-only grants, not a lost cart.
  if (lines.length === 0 && items.length > 0) throw new Error('articles Stripe manquants');
  const merchandiseCents = paidLines.reduce((total, line) => total + line.amount_total, 0);
  if (!Number.isSafeInteger(merchandiseCents)) throw new Error('montant Stripe invalide');
  const { data: existingOrder, error: readError } = await supabase.from('orders')
    .select('id').eq('stripe_session_id', sessionId).maybeSingle();
  if (readError) throw new Error('lecture commande impossible');
  let order = existingOrder;
  if (!order) {
    const inserted = await supabase.from('orders').insert({
      user_id: buyerId,
      order_number: `KDV-${crypto.randomUUID()}`,
      status: 'confirmed', payment_method: 'card',
      shipping_address: expandedSession.shipping_details?.address || {}, items,
      subtotal_eur: (expandedSession.amount_subtotal || 0) / 100,
      shipping_eur: (expandedSession.shipping_cost?.amount_total || 0) / 100,
      total_eur: (expandedSession.amount_total || 0) / 100,
      notes: `Stripe session: ${sessionId}`, stripe_session_id: sessionId,
    }).select('id').single();
    order = inserted.data;
    if (inserted.error?.code === '23505') {
      const concurrent = await supabase.from('orders').select('id')
        .eq('stripe_session_id', sessionId).maybeSingle();
      if (concurrent.error) throw new Error('lecture commande concurrente impossible');
      order = concurrent.data;
    } else if (inserted.error) throw new Error('création commande impossible');
  }
  if (!order) throw new Error('commande de paiement introuvable');
  const { data: resumed, error: resumeError } = await supabase.rpc('resume_stripe_checkout', {
    p_order_id: order.id, p_session_id: sessionId, p_lines: lines,
    p_merchandise_cents: merchandiseCents, p_metadata: expandedSession.metadata || {},
  });
  if (resumeError || !resumed || typeof resumed.terminal !== 'boolean' || !Array.isArray(resumed.items)) {
    throw new Error('reprise transactionnelle du paiement impossible');
  }
  if (resumed.terminal) return { duplicate: Boolean(existingOrder) };
  const createdOrderItemIds = resumed.items as {
    productId: string; orderItemId: string; totalCents: number;
  }[];

  // ── Part créateur (Lot 6) : attribution depuis metadata.kit_ref validé ──
  const kitRef = expandedSession.metadata?.kit_ref as string | undefined;
  if (kitRef && createdOrderItemIds.length > 0 && buyerId) {
    try {
      const { data: kitRow, error: kitError } = await supabase
        .from('materiel_kits')
        .select('user_id, ancestors')
        .eq('id', kitRef)
        .maybeSingle();
      if (kitError) throw new Error('lecture kit impossible');
      if (kitRow) {
        const ancestors = (kitRow.ancestors as string[] | null) ?? [];
        const ancestorOwners = new Map<string, string>();
        if (ancestors.length > 0) {
          const { data: ancKits, error: ancestorsError } = await supabase
            .from('materiel_kits')
            .select('id, user_id')
            .in('id', ancestors);
          if (ancestorsError) throw new Error('lecture ancêtres impossible');
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
        const { data: cfgRow, error: configError } = await supabase
          .from('royalty_config')
          .select('value')
          .eq('key', 'global')
          .maybeSingle();
        if (configError) throw new Error('lecture barème impossible');
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
          const { error: attributionError } = await supabase.rpc('insert_kit_attribution', {
            p_kit_id: kitRef,
            p_order_item_id: oi.orderItemId,
            p_product_id: oi.productId,
            p_amount_cents: oi.totalCents,
            p_rate_bps: rateBps,
            p_shares: shares.map((s) => ({
                beneficiary_id: s.beneficiaryId,
                generation_gap: s.generationGap,
                share_cents: s.shareCents,
              })),
            p_buyer_user_id: buyerId,
          });
          if (attributionError) throw new Error('attribution refusée');
        }
      }
    } catch (attrErr) {
      throw new Error('attribution du paiement impossible', { cause: attrErr });
    }
  }

  if (intentId) {
    const { error } = await supabase.from('checkout_intents').update({ status: 'used' }).eq('id', intentId);
    if (error) throw new Error('finalisation panier de paiement impossible');
  }
  return { duplicate: Boolean(existingOrder) };
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
 * session PUIS émet l'événement d'encaissement inverse (T38) — borné par ce
 * qui a été réellement encaissé et idempotent par événement. L'échec de l'un
 * ou de l'autre propage (Stripe rejouera), jamais une perte silencieuse de
 * crédits déjà émis.
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

  // Jamais avalé : l'échec propage, la réservation est libérée et Stripe rejoue
  // (le RPC est idempotent : il ne touche que les attributions non encore reversées).
  const { error: reverseError } = await supabase.rpc('reverse_kit_attribution_by_session', {
    p_stripe_session_id: sessionId,
  });
  if (reverseError) {
    throw new Error(`reversement part créateur refusé (${reverseError.code ?? 'erreur'})`);
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
    // Checkout retains its durable row: concurrent resumptions are serialized
    // by the order lock, and no failing worker can delete a successful mark.
    if (classifyStripeEvent(event) !== 'checkout_completed') {
      await releaseStripeEvent(supabase, summary.eventId);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
