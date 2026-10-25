import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { parseWallet, type Wallet } from '../domain/wallet';

/**
 * Accès serveur au programme de points : fonctions SQL `rewards_*`
 * (SECURITY DEFINER, EXECUTE au seul service_role). L'identité vient toujours
 * de la session vérifiée par la route ; le client ne fournit ni points, ni
 * prix, ni identifiant de membre.
 */

export type ServiceOutcome<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

type RpcPayload = Record<string, unknown> & { success?: boolean; error?: string };

const ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  user_not_found: 404,
  award_not_found: 404,
  redemption_not_found: 404,
  reward_unavailable: 409,
  reward_unfunded: 409,
  out_of_stock: 409,
  insufficient_balance: 409,
  payment_required: 409,
  idempotency_conflict: 409,
  not_cancellable: 409,
  not_confirmed: 409,
  not_pending: 409,
  emission_closed: 409,
  producer_closed: 409,
  unknown_rule: 400,
  invalid_config: 503,
  service_indisponible: 503,
};

function statusFor(code: string): number {
  return ERROR_STATUS[code] ?? 500;
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<ServiceOutcome<RpcPayload>> {
  const service = getServiceSupabase();
  if (!service) return { ok: false, status: 503, error: 'service_indisponible' };
  const { data, error } = await service.rpc(fn, args);
  if (error) {
    // Message SQL jamais renvoyé au client ; aucun identifiant journalisé.
    console.warn(`[rewards] ${fn} en échec (${error.code ?? 'sans code'})`);
    return { ok: false, status: 500, error: 'internal_error' };
  }
  const payload = (data ?? null) as RpcPayload | null;
  if (!payload || payload.success !== true) {
    const code = typeof payload?.error === 'string' ? payload.error : 'internal_error';
    return { ok: false, status: statusFor(code), error: code };
  }
  return { ok: true, data: payload };
}

/**
 * Snapshot validé par `parseWallet` puis renvoyé brut : le client le relit
 * avec la même validation et le garde tel quel comme dernier solde connu.
 */
export async function getWallet(userId: string): Promise<ServiceOutcome<{ wallet: Wallet; snapshot: RpcPayload }>> {
  const outcome = await callRpc('rewards_wallet_snapshot', { p_user_id: userId });
  if (!outcome.ok) return outcome;
  const wallet = parseWallet(outcome.data);
  if (!wallet) {
    console.warn('[rewards] snapshot illisible');
    return { ok: false, status: 500, error: 'internal_error' };
  }
  return { ok: true, data: { wallet, snapshot: outcome.data } };
}

export async function setGoal(userId: string, rewardId: string | null): Promise<ServiceOutcome<{ rewardId: string | null }>> {
  const outcome = await callRpc('rewards_set_goal', { p_user_id: userId, p_reward_id: rewardId });
  if (!outcome.ok) return outcome;
  return { ok: true, data: { rewardId } };
}

export interface RedeemResult {
  status: string;
  redemptionId: string | null;
  reference: string | null;
  pointsSpent: number;
  balance: number;
  idempotent: boolean;
}

export async function redeem(userId: string, rewardId: string, idempotencyKey: string): Promise<ServiceOutcome<RedeemResult>> {
  const outcome = await callRpc('rewards_redeem', {
    p_user_id: userId,
    p_reward_id: rewardId,
    p_idempotency_key: idempotencyKey,
  });
  if (!outcome.ok) return outcome;
  const d = outcome.data;
  return {
    ok: true,
    data: {
      status: typeof d.status === 'string' ? d.status : 'reserved',
      redemptionId: typeof d.redemption_id === 'string' ? d.redemption_id : null,
      reference: typeof d.reference === 'string' ? d.reference : null,
      pointsSpent: typeof d.points_spent === 'number' ? d.points_spent : 0,
      balance: typeof d.balance === 'number' ? d.balance : 0,
      idempotent: d.idempotent === true,
    },
  };
}

export interface AwardResult {
  status: 'confirmed' | 'pending' | 'refused' | 'duplicate';
  points: number;
  reason: string | null;
  balance: number | null;
}

/**
 * Attribution d'un fait déjà vérifié par l'appelant serveur. Fermée tant que
 * `points_program` ne l'ouvre pas (réponse `emission_closed`, rien n'est écrit).
 */
export async function awardPoints(
  userId: string,
  ruleKey: string,
  sourceType: string,
  sourceId: string
): Promise<ServiceOutcome<AwardResult>> {
  const outcome = await callRpc('rewards_award_points', {
    p_user_id: userId,
    p_rule_key: ruleKey,
    p_source_type: sourceType,
    p_source_id: sourceId,
  });
  if (!outcome.ok) return outcome;
  const d = outcome.data;
  const status = d.status === 'confirmed' || d.status === 'pending' || d.status === 'refused' || d.status === 'duplicate'
    ? d.status
    : 'refused';
  return {
    ok: true,
    data: {
      status,
      points: typeof d.points === 'number' ? d.points : 0,
      reason: typeof d.reason === 'string' ? d.reason : null,
      balance: typeof d.balance === 'number' ? d.balance : null,
    },
  };
}

/** Actions d'administration (garde admin vérifiée par la route). */
export function cancelRedemption(redemptionId: string, reason: string) {
  return callRpc('rewards_cancel_redemption', { p_redemption_id: redemptionId, p_reason: reason });
}

export function reverseAward(awardId: string, reason: string) {
  return callRpc('rewards_reverse_award', { p_award_id: awardId, p_reason: reason });
}

export function decideAward(awardId: string, approve: boolean, reason: string | null) {
  return callRpc('rewards_decide_award', { p_award_id: awardId, p_approve: approve, p_reason: reason });
}
