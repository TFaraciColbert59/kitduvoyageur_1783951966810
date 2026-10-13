import 'server-only';

/**
 * T32 — Cycle d'un prêt réel : prêteur et emprunteur distincts, durée ≥ 24 h,
 * DEUX confirmations de retour avant attribution, un gain par rôle et par
 * prêt, objet/paire verrouillés 90 jours.
 */

export type LoanRefusal =
  | 'pret_a_soi'
  | 'duree_insuffisante'
  | 'retour_non_confirme'
  | 'role_deja_credite'
  | 'objet_ou_paire_sous_delai';

export interface LoanInput {
  lenderId: string;
  borrowerId: string;
  startedAt: string;
  returnedAt: string | null;
  lenderConfirmedReturn: boolean;
  borrowerConfirmedReturn: boolean;
  role: 'lender' | 'borrower';
  /** Le même prêt a-t-il déjà crédité ce rôle ? */
  roleAlreadyCreditedForLoan: boolean;
  /** Dernier crédit objet/paire (le cas échéant) et sa date. */
  lastObjectOrPairCreditAt?: string | null;
  now?: Date;
}

export const LOAN_MIN_HOURS = 24;
export const LOAN_OBJECT_PAIR_COOLDOWN_DAYS = 90;

export function evaluateLoan(
  input: LoanInput
): { ok: true } | { ok: false; reason: LoanRefusal } {
  if (!input.lenderId || !input.borrowerId || input.lenderId === input.borrowerId) {
    return { ok: false, reason: 'pret_a_soi' };
  }
  if (!input.returnedAt) return { ok: false, reason: 'retour_non_confirme' };

  const started = Date.parse(input.startedAt);
  const returned = Date.parse(input.returnedAt);
  if (!Number.isFinite(started) || !Number.isFinite(returned)) {
    return { ok: false, reason: 'duree_insuffisante' };
  }
  const hours = (returned - started) / 3_600_000;
  if (hours < LOAN_MIN_HOURS) return { ok: false, reason: 'duree_insuffisante' };

  if (!input.lenderConfirmedReturn || !input.borrowerConfirmedReturn) {
    return { ok: false, reason: 'retour_non_confirme' };
  }
  if (input.roleAlreadyCreditedForLoan) return { ok: false, reason: 'role_deja_credite' };

  if (input.lastObjectOrPairCreditAt) {
    const last = Date.parse(input.lastObjectOrPairCreditAt);
    const now = (input.now ?? new Date()).getTime();
    if (Number.isFinite(last) && now - last < LOAN_OBJECT_PAIR_COOLDOWN_DAYS * 86_400_000) {
      return { ok: false, reason: 'objet_ou_paire_sous_delai' };
    }
  }
  return { ok: true };
}
