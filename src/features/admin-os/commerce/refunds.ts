/**
 * Refund workflow — logique pure (testable) + types partagés routes.
 * État remboursements = `admin_commands` (succeeded) — aucune table ad hoc.
 * Exécution prestataire : manuelle/Stripe dashboard avec référence tracée
 * (pas de charge auto sans plomberie prestataire prouvée — voir rapport).
 */

/** Seuil financier : ≥ 1000 € → Tier4 + second approbateur (SoD). */
export const REFUND_APPROVAL_THRESHOLD_EUR = 1000;

export interface RefundPreview {
  order_total_eur: number;
  prior_refunded_eur: number;
  requested_eur: number;
  remaining_eur: number;
  requires_tier4_approval: boolean;
}

/** Impact prévisionnel ; lève si dépassement ou montant invalide. */
export function previewRefund(
  order: { total_eur: number },
  priorRefundedEur: number,
  requestedEur: number
): RefundPreview {
  if (!Number.isFinite(requestedEur) || requestedEur <= 0) {
    throw new Error('refund_invalid_amount');
  }
  const remaining = order.total_eur - priorRefundedEur - requestedEur;
  if (remaining < 0) throw new Error('refund_exceeds_remaining');
  return {
    order_total_eur: order.total_eur,
    prior_refunded_eur: priorRefundedEur,
    requested_eur: requestedEur,
    remaining_eur: remaining,
    requires_tier4_approval: requestedEur >= REFUND_APPROVAL_THRESHOLD_EUR,
  };
}

export interface RefundFingerprint {
  command_key: 'commerce.refund.request' | 'commerce.refund.approve';
  resource_type: 'order';
  resource_id: string;
  reason: string;
  risk_tier: 3 | 4;
}

/** Routage Tier3/Tier4 au seuil, sur exposition CUMULÉE (anti-smurfing :
 * 3×800 € = 2400 € → Tier4). Clé d'idempotence = commande + motif.
 * `priorEur` = déjà remboursé + en-cours (validated→succeeded). */
export function buildRefundCommand(
  orderId: string,
  amountEur: number,
  reason: string,
  priorEur = 0
): RefundFingerprint {
  const tier4 = amountEur + priorEur >= REFUND_APPROVAL_THRESHOLD_EUR;
  return {
    command_key: tier4 ? 'commerce.refund.approve' : 'commerce.refund.request',
    resource_type: 'order',
    resource_id: orderId,
    reason,
    risk_tier: tier4 ? 4 : 3,
  };
}
