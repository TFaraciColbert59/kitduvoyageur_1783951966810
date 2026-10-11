/**
 * T39 — Valorisation des bons CÔTÉ SERVEUR.
 *
 * La réduction appliquée est bornée par le plus petit de :
 *   • la valeur du bon ;
 *   • 10 % du panier éligible ;
 *   • 25 % de la marge contributive vérifiée.
 * Seule la réduction RÉELLEMENT consommée est débitée ; le reste du bon est
 * conservé. Marge inconnue ou négative → aucun nouveau bon émis (le panier
 * reste achetable). Le client ne détermine jamais prix, coût ni réduction.
 */

export type VoucherRefusal =
  | 'panier_vide'
  | 'marge_inconnue'
  | 'marge_negative'
  | 'bon_sans_valeur';

export interface VoucherQuoteInput {
  /** Valeur du bon en centimes (issue du catalogue serveur). */
  voucherValueCents: number;
  /** Panier éligible en centimes (marchandises, hors livraison). */
  eligibleCartCents: number;
  /** Marge contributive vérifiée en centimes ; null = inconnue. */
  contributionMarginCents: number | null;
}

export interface VoucherQuote {
  /** Réduction effectivement appliquée (débitée au bon). */
  appliedDiscountCents: number;
  /** Valeur restante du bon après consommation partielle. */
  remainingVoucherCents: number;
}

export const MAX_CART_SHARE = 0.1;
export const MAX_MARGIN_SHARE = 0.25;

export function quoteVoucher(
  input: VoucherQuoteInput
): { ok: true; quote: VoucherQuote } | { ok: false; reason: VoucherRefusal } {
  if (input.voucherValueCents <= 0) return { ok: false, reason: 'bon_sans_valeur' };
  if (input.eligibleCartCents <= 0) return { ok: false, reason: 'panier_vide' };
  if (input.contributionMarginCents === null) return { ok: false, reason: 'marge_inconnue' };
  if (input.contributionMarginCents <= 0) return { ok: false, reason: 'marge_negative' };

  const applied = Math.max(
    0,
    Math.min(
      Math.floor(input.voucherValueCents),
      Math.floor(input.eligibleCartCents * MAX_CART_SHARE),
      Math.floor(input.contributionMarginCents * MAX_MARGIN_SHARE)
    )
  );

  return {
    ok: true,
    quote: {
      appliedDiscountCents: applied,
      remainingVoucherCents: Math.max(0, Math.floor(input.voucherValueCents) - applied),
    },
  };
}

/**
 * Reprise après échec de paiement : si la réduction n'a PAS été consommée
 * (paiement raté, panier modifié), le bon est restauré à sa valeur initiale.
 * Si la réduction a été consommée, seul le RESTE est restauré (mouvement
 * traçable) — jamais de débit silencieux.
 */
export function restoreVoucher(input: {
  initialVoucherCents: number;
  appliedDiscountCents: number;
  discountConsumed: boolean;
}): number {
  if (input.discountConsumed) {
    return Math.max(0, input.initialVoucherCents - input.appliedDiscountCents);
  }
  return Math.max(0, input.initialVoucherCents);
}
