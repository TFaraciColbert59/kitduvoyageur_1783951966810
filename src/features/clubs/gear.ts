export type ClubGearLoanStatus =
  | 'requested'
  | 'approved'
  | 'checked_out'
  | 'returned'
  | 'overdue'
  | 'issue'
  | 'declined'
  | 'cancelled';

export type ClubGearCondition = 'new' | 'good' | 'worn' | 'repair';

const ALLOWED_TRANSITIONS: Record<ClubGearLoanStatus, readonly ClubGearLoanStatus[]> = {
  requested: ['approved', 'declined', 'cancelled'],
  approved: ['checked_out', 'cancelled', 'declined'],
  checked_out: ['returned', 'overdue', 'issue'],
  overdue: ['returned', 'issue'],
  issue: ['returned'],
  returned: [],
  declined: [],
  cancelled: [],
};

export function isLoanTransitionAllowed(
  fromStatus: ClubGearLoanStatus,
  toStatus: ClubGearLoanStatus,
): boolean {
  return ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

/**
 * Règle de stock validée : la quantité est réservée dès le passage à `approved`,
 * conservée sur `checked_out`/`overdue`/`issue`, et libérée sur `returned`/`declined`/`cancelled`.
 */
export function computeNextGearStock(params: {
  quantityTotal: number;
  quantityAvailable: number;
  loanQuantity: number;
  fromStatus: ClubGearLoanStatus;
  toStatus: ClubGearLoanStatus;
}): { ok: true; quantityAvailable: number; available: boolean } | { ok: false; error: string } {
  const { quantityTotal, quantityAvailable, loanQuantity, fromStatus, toStatus } = params;
  if (!isLoanTransitionAllowed(fromStatus, toStatus)) {
    return { ok: false, error: `Transition ${fromStatus} -> ${toStatus} interdite` };
  }
  const holdsStock = (s: ClubGearLoanStatus) =>
    s === 'approved' || s === 'checked_out' || s === 'overdue' || s === 'issue';

  const wasHolding = holdsStock(fromStatus);
  const willHold = holdsStock(toStatus);

  let nextAvail = quantityAvailable;
  if (!wasHolding && willHold) {
    if (quantityAvailable < loanQuantity) {
      return { ok: false, error: 'Stock insuffisant pour valider ce prêt' };
    }
    nextAvail = quantityAvailable - loanQuantity;
  } else if (wasHolding && !willHold) {
    nextAvail = Math.min(quantityTotal, quantityAvailable + loanQuantity);
  }

  return {
    ok: true,
    quantityAvailable: nextAvail,
    available: nextAvail > 0,
  };
}
