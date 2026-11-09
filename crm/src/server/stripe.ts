import 'server-only';
import Stripe from 'stripe';
import { apiError, isApiError, logServer, redact } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/db';

/**
 * Stripe côté serveur — remboursements.
 *
 * Séquence imposée (02_ARCHITECTURE § 6) :
 *   admin.approve_request → stripe.refunds.create(idempotencyKey = crm-refund-<request_id>)
 *   → admin.complete_request → notification d'équipe.
 *
 * Mode test uniquement : toute clé qui n'est pas `sk_test_…` est refusée
 * explicitement. Le premier remboursement réel est fait par une personne dans
 * Stripe (08_GARDE_FOUS § 1.6).
 */
const STRIPE_API_VERSION = '2025-02-24.acacia' as const;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).length > 12);
}

export function stripeKeyIsTest(): boolean {
  return String(process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_');
}

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.length <= 12) throw apiError('stripe_unavailable');
  if (!key.startsWith('sk_test_')) throw apiError('stripe_test_only');
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 1, timeout: 20_000 });
}

export type RefundInput = {
  requestId: string;
  orderId: string;
  paymentIntent: string;
  amountCents: number;
  reason?: string;
};

export type RefundOutcome = {
  ok: boolean;
  refund_id: string | null;
  status: string | null;
  amount_cents: number;
};

/** Un seul envoi par demande : la clé d'idempotence EST l'identifiant de requête. */
export async function refundPayment(input: RefundInput): Promise<RefundOutcome> {
  const stripe = stripeClient();
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: input.paymentIntent,
        amount: input.amountCents,
        reason: 'requested_by_customer',
        metadata: { request_id: input.requestId, order_id: input.orderId }
      },
      { idempotencyKey: `crm-refund-${input.requestId}` }
    );
    return {
      ok: true,
      refund_id: refund.id,
      status: refund.status ?? null,
      amount_cents: refund.amount ?? input.amountCents
    };
  } catch (error) {
    const message = error instanceof Error ? redact(error.message) : 'stripe_error';
    logServer({ level: 'error', scope: 'crm', event: 'stripe_refund_failed', message });
    throw apiError('external_failed');
  }
}

/**
 * `admin.complete_request` : clôt la demande après l'effet externe.
 * Tolérant : si la RPC n'est pas déployée, on le journalise sans mentir sur le résultat.
 */
export async function completeRequest(
  client: SupabaseClient<Database>,
  requestId: string,
  result: Record<string, unknown>,
  errorCode?: string
): Promise<{ ok: boolean; applied: boolean }> {
  const { data, error } = await client.schema('admin').rpc('complete_request', {
    p_request: requestId,
    p_result: result as unknown as Json,
    p_error: errorCode ?? (result.ok === false && typeof result.error === 'string' ? result.error : null)
  });
  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42P01';
    logServer({
      level: missing ? 'warn' : 'error',
      scope: 'crm',
      event: 'complete_request_failed',
      pg_code: error.code ?? null,
      hint: error.hint ?? null
    });
    return { ok: false, applied: false };
  }
  const payload = (data ?? {}) as { ok?: unknown };
  return { ok: payload.ok !== false, applied: true };
}

export type ExternalOutcome = {
  attempted: boolean;
  ok: boolean;
  kind: 'refund' | 'none';
  message: string;
  request_id: string;
};

type RequestDetailLike = {
  command?: string;
  params?: Record<string, unknown>;
  order_id?: string;
  payment?: { intent_id?: string | null };
};

async function resolveRequestParams(
  client: SupabaseClient<Database>,
  requestId: string
): Promise<{ command: string; params: Record<string, unknown> } | null> {
  const { data, error } = await client.schema('admin').rpc('request_detail', { p_request: requestId });
  if (error) return null;
  const detail = (data ?? {}) as RequestDetailLike;
  if (typeof detail.command !== 'string') return null;
  return { command: detail.command, params: detail.params ?? {} };
}

async function resolvePaymentIntent(
  client: SupabaseClient<Database>,
  orderId: string
): Promise<string | null> {
  const { data, error } = await client.schema('admin').rpc('order_detail', { p_order: orderId });
  if (error) return null;
  const detail = (data ?? {}) as { payment?: { intent_id?: unknown } };
  const intent = detail.payment?.intent_id;
  return typeof intent === 'string' && intent.length > 4 ? intent : null;
}

/**
 * Effet externe d'une demande validée. Appelée par `/api/approve` après que la
 * base a exécuté `admin.approve_request` (statut `executed`).
 * Ne lève jamais : un échec Stripe clôt la demande en `failed` sans double envoi.
 */
export async function settleApprovedRequest(
  client: SupabaseClient<Database>,
  requestId: string,
  snapshot?: { command: string; params: Record<string, unknown> }
): Promise<ExternalOutcome> {
  const resolved = snapshot ?? (await resolveRequestParams(client, requestId));
  if (!resolved || resolved.command !== 'order_refund') {
    return { attempted: false, ok: true, kind: 'none', message: 'Aucun effet externe à exécuter.', request_id: requestId };
  }

  const orderId = typeof resolved.params.order_id === 'string' ? resolved.params.order_id : null;
  const amountCents = Number(resolved.params.amount_cents ?? resolved.params.refund_cents ?? 0);
  if (!orderId || !Number.isFinite(amountCents) || amountCents <= 0) {
    await completeRequest(client, requestId, { ok: false, error: 'invalid_params' });
    return {
      attempted: true,
      ok: false,
      kind: 'refund',
      message: 'Remboursement impossible : commande ou montant illisible.',
      request_id: requestId
    };
  }

  const paymentIntent =
    typeof resolved.params.payment_intent === 'string' && resolved.params.payment_intent.length > 4
      ? resolved.params.payment_intent
      : await resolvePaymentIntent(client, orderId);

  if (!paymentIntent) {
    await completeRequest(client, requestId, { ok: false, error: 'payment_intent_absent' });
    return {
      attempted: true,
      ok: false,
      kind: 'refund',
      message: 'Remboursement impossible : paiement introuvable pour cette commande.',
      request_id: requestId
    };
  }

  if (!stripeConfigured()) {
    await completeRequest(client, requestId, { ok: false, error: 'stripe_unavailable' });
    return {
      attempted: true,
      ok: false,
      kind: 'refund',
      message: 'Stripe n’est pas configuré : le remboursement reste à faire par une personne dans Stripe.',
      request_id: requestId
    };
  }

  try {
    const outcome = await refundPayment({ requestId, orderId, paymentIntent, amountCents });
    await completeRequest(client, requestId, {
      ok: true,
      provider: 'stripe',
      refund_id: outcome.refund_id,
      status: outcome.status,
      amount_cents: outcome.amount_cents
    });
    return {
      attempted: true,
      ok: true,
      kind: 'refund',
      message: 'Remboursement test exécuté et demande clôturée.',
      request_id: requestId
    };
  } catch (error) {
    const apiErr = isApiError(error) ? error : apiError('external_failed');
    await completeRequest(client, requestId, { ok: false, error: apiErr.code });
    return { attempted: true, ok: false, kind: 'refund', message: apiErr.message, request_id: requestId };
  }
}
