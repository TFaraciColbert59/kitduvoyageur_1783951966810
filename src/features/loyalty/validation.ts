/**
 * Phase 1 — validation PURE des corps des routes loyalty (sans IO).
 *
 * Le barème des gains vit ici et nulle part ailleurs : les points ne viennent
 * JAMAIS du client. La source earn est préfixée par producteur pour éviter
 * toute collision d'idempotence avec les autres écritures du journal.
 */

export const EARN_ACTIONS: Record<string, { points: number; sourcePrefix: string }> = {
  rapport_expedition: { points: 75, sourcePrefix: 'rapport' },
};

export type SpendInput = { points: number; reason: string; sourceId: string };
export type EarnInput = { action: string; points: number; sourceId: string };
export type RefundInput = { cartItemId: string };
export type RedeemInput = { rewardId: string };

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Suffixe de source (charset commun à tous les producteurs de points). */
const SOURCE_SUFFIX_RE = /^[A-Za-z0-9:_-]{1,100}$/;
/** Dépense panier : préfixe imposé, anti-collision avec les autres producteurs. */
const CART_FREE_SOURCE_RE = /^cart_free_apply:[A-Za-z0-9:_-]{1,100}$/;
const CART_ITEM_RE = /^[A-Za-z0-9:_-]{1,120}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

/** `{ points > 0 entier, reason 1..200 défaut 'Dépense', sourceId cart_free_apply:… }`. */
export function parseSpendBody(input: unknown): ParseResult<SpendInput> {
  if (!isRecord(input)) return { ok: false, error: 'invalid_body' };

  const { points, sourceId } = input;
  const rawReason = input.reason;

  if (typeof points !== 'number' || !Number.isInteger(points) || points <= 0) {
    return { ok: false, error: 'invalid_points' };
  }

  let reason = 'Dépense';
  if (rawReason !== undefined && rawReason !== null) {
    if (typeof rawReason !== 'string' || rawReason.length === 0 || rawReason.length > 200) {
      return { ok: false, error: 'invalid_reason' };
    }
    reason = rawReason;
  }

  if (typeof sourceId !== 'string' || !CART_FREE_SOURCE_RE.test(sourceId)) {
    return { ok: false, error: 'invalid_source' };
  }

  return { ok: true, value: { points, reason, sourceId } };
}

/** `{ action ∈ EARN_ACTIONS, sourceId 1..100 }` — points imposés par le barème. */
export function parseEarnBody(input: unknown): ParseResult<EarnInput> {
  if (!isRecord(input)) return { ok: false, error: 'invalid_body' };

  const { action, sourceId } = input;
  if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(EARN_ACTIONS, action)) {
    return { ok: false, error: 'invalid_action' };
  }
  if (typeof sourceId !== 'string' || !SOURCE_SUFFIX_RE.test(sourceId)) {
    return { ok: false, error: 'invalid_source' };
  }

  const rule = EARN_ACTIONS[action];
  return {
    ok: true,
    value: { action, points: rule.points, sourceId: `${rule.sourcePrefix}:${sourceId}` },
  };
}

/** `{ cartItemId 1..120 }`. */
export function parseRefundBody(input: unknown): ParseResult<RefundInput> {
  if (!isRecord(input)) return { ok: false, error: 'invalid_body' };

  const { cartItemId } = input;
  if (typeof cartItemId !== 'string' || !CART_ITEM_RE.test(cartItemId)) {
    return { ok: false, error: 'invalid_cart_item' };
  }

  return { ok: true, value: { cartItemId } };
}

/** `{ rewardId UUID }` (casse indifférente). */
export function parseRedeemBody(input: unknown): ParseResult<RedeemInput> {
  if (!isRecord(input)) return { ok: false, error: 'invalid_body' };

  const { rewardId } = input;
  if (typeof rewardId !== 'string' || !UUID_RE.test(rewardId)) {
    return { ok: false, error: 'invalid_reward' };
  }

  return { ok: true, value: { rewardId } };
}
