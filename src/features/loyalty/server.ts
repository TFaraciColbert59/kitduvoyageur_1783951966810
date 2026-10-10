import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import type { OrderBody } from '@/features/checkout/serverPricing';
import type { EarnInput, RedeemInput, RefundInput, SpendInput } from './validation';

/**
 * Phase 1 — écritures loyalty via RPC service_role uniquement.
 *
 * L'identité vient toujours de la session vérifiée par la route ; le client
 * ne fournit ni points (spend : montant borné par le solde côté RPC) ni prix.
 */

export type RpcOutcome<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

type LoyaltyData = { balance: number; level: string; idempotent?: boolean };
type OrderData = { orderId: string; orderNumber: string; totalEur: number };

type RpcPayload = {
  success?: boolean;
  error?: string;
  balance?: number;
  level?: string;
  idempotent?: boolean;
  orderId?: string;
  orderNumber?: string;
  totalEur?: number | string;
};

/** Erreurs métier RPC → statut HTTP (le préfixe `invalid_` → 400). */
const RPC_ERROR_STATUS: Record<string, number> = {
  insufficient_balance: 409,
  already_redeemed: 409,
  reward_unavailable: 409,
  no_apply: 409,
  user_not_found: 404,
  service_indisponible: 503,
};

/** Échelle niveau legacy — miroir de `legacy_loyalty_level_for`. */
const LEVEL_SCALE: Array<{ min: number; label: string }> = [
  { min: 7500, label: 'Légende du Voyage' },
  { min: 3500, label: 'Guide de Montagne' },
  { min: 1500, label: 'Randonneur Expert' },
  { min: 500, label: 'Aventurier' },
  { min: 0, label: 'Explorateur' },
];

function levelForBalance(balance: number): string {
  for (const step of LEVEL_SCALE) {
    if (balance >= step.min) return step.label;
  }
  return 'Explorateur';
}

function errorStatus(code: string): number {
  if (code.startsWith('invalid_') || code === 'unknown_product') return 400;
  return RPC_ERROR_STATUS[code] ?? 500;
}

async function callLoyaltyRpc(
  rpcName: string,
  args: Record<string, unknown>
): Promise<RpcOutcome<LoyaltyData>> {
  const service = getServiceSupabase();
  if (!service) return { ok: false, status: 503, error: 'service_indisponible' };

  const { data, error } = await service.rpc(rpcName, args);
  if (error) {
    console.warn(`[loyalty/server] RPC ${rpcName} en échec:`, error.message);
    return { ok: false, status: 500, error: 'internal_error' };
  }

  const payload = (data ?? null) as RpcPayload | null;
  if (!payload || payload.success !== true) {
    const code = payload?.error ?? 'internal_error';
    return { ok: false, status: errorStatus(code), error: code };
  }

  const balance = typeof payload.balance === 'number' ? payload.balance : 0;
  const result: LoyaltyData = {
    balance,
    // Le chemin idempotent de la RPC ne renvoie pas de niveau : dérivé du solde.
    level: typeof payload.level === 'string' ? payload.level : levelForBalance(balance),
  };
  if (payload.idempotent === true) result.idempotent = true;
  return { ok: true, data: result };
}

export function rpcSpend(
  userId: string,
  input: SpendInput
): Promise<RpcOutcome<{ balance: number; level: string; idempotent?: boolean }>> {
  return callLoyaltyRpc('legacy_loyalty_spend', {
    p_user_id: userId,
    p_points: input.points,
    p_reason: input.reason,
    p_source_id: input.sourceId,
  });
}

export function rpcEarn(
  userId: string,
  input: EarnInput
): Promise<RpcOutcome<{ balance: number; level: string; idempotent?: boolean }>> {
  return callLoyaltyRpc('legacy_loyalty_earn', {
    p_user_id: userId,
    p_points: input.points,
    p_reason: null,
    p_source_id: input.sourceId,
  });
}

export function rpcRefund(
  userId: string,
  input: RefundInput
): Promise<RpcOutcome<{ balance: number; level: string; idempotent?: boolean }>> {
  return callLoyaltyRpc('legacy_loyalty_cart_refund', {
    p_user_id: userId,
    p_cart_item_id: input.cartItemId,
  });
}

export async function rpcRedeem(
  userId: string,
  input: RedeemInput
): Promise<RpcOutcome<{ balance: number; level: string }>> {
  const outcome = await callLoyaltyRpc('legacy_loyalty_redeem', {
    p_user_id: userId,
    p_reward_id: input.rewardId,
  });
  if (!outcome.ok) return outcome;
  return { ok: true, data: { balance: outcome.data.balance, level: outcome.data.level } };
}

export async function createOrder(
  userId: string,
  body: OrderBody
): Promise<RpcOutcome<OrderData>> {
  const service = getServiceSupabase();
  if (!service) return { ok: false, status: 503, error: 'service_indisponible' };

  const { data, error } = await service.rpc('create_shop_order', {
    p_user_id: userId,
    p_payment_method: 'virement',
    p_shipping_address: body.shipping,
    p_items: body.lines.map((line) => ({ slug: line.slug, quantity: line.quantity })),
    p_shipping_option: body.shippingOption,
  });

  if (error) {
    console.warn('[loyalty/server] RPC create_shop_order en échec:', error.message);
    return { ok: false, status: 500, error: 'internal_error' };
  }

  const payload = (data ?? null) as RpcPayload | null;
  if (!payload || payload.success !== true) {
    const code = payload?.error ?? 'internal_error';
    return { ok: false, status: errorStatus(code), error: code };
  }

  return {
    ok: true,
    data: {
      orderId: String(payload.orderId ?? ''),
      orderNumber: String(payload.orderNumber ?? ''),
      totalEur: typeof payload.totalEur === 'number' ? payload.totalEur : Number(payload.totalEur ?? 0),
    },
  };
}
