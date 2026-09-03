/**
 * Part créateur (chantier lignées, Lot 6) — répartition 70/20/10 sur 3
 * générations, en centimes, avec un INVARIANT STRICT : la somme des parts
 * équivaut toujours à la commission totale (aucun centime perdu ni créé).
 *
 * L'écrasante majorité des calculs vit côté serveur (RPC SECURITY DEFINER,
 * webhook) ; ce module pur est le cœur de la répartition — testé sans base.
 */

/** Barème par défaut (bps) : 300 = 3 % de la valeur d'une commande. */
export const DEFAULT_ROYALTY_GLOBAL_BPS = 300;

/** Poids par génération (deniers par 10000) : 70/20/10. */
export const DEFAULT_ROYALTY_WEIGHTS: Record<number, number> = {
  0: 7000,
  1: 2000,
  2: 1000,
};

/** Extinction au-delà de 3 générations. */
export const MAX_ROYALTY_GENERATIONS = 3;

/** Plancher : une part inférieure à 1 centime n'est pas créée. */
export const ROYALTY_FLOOR_CENTS = 1;

export interface RoyaltyGapInput {
  beneficiaryId: string;
  generationGap: number;
}

export interface RoyaltyShare {
  beneficiaryId: string;
  generationGap: number;
  shareCents: number;
}

export interface RoyaltyOutput {
  commissionCents: number;
  shares: RoyaltyShare[];
}

/**
 * Répartit une commission (en centimes) entre les bénéficiaires éligibles.
 * - Seules les générations < MAX_ROYALTY_GENERATIONS (0, 1, 2) reçoivent.
 * - L'acheteur est toujours exclu (on ne se paie pas sur son propre achat).
 * - Plancher : aucune part < 1 centime ; les parts évanescentes sont retirées
 *   et leur poids redistribué proportionnellement.
 * - Invariant strict : sum(shares) === commissionCents.
 * - Les restes d'arrondi vont au forkeur (gap le plus petit) en priorité.
 */
export function computeRoyaltyShares(input: {
  commissionCents: number;
  weights?: Record<number, number>;
  gaps: RoyaltyGapInput[];
  buyerId?: string | null;
}): RoyaltyOutput {
  const weights = input.weights ?? DEFAULT_ROYALTY_WEIGHTS;
  const commission = Math.max(0, Math.floor(input.commissionCents));

  if (commission <= 0) return { commissionCents: 0, shares: [] };

  // Gaps éligibles (bornés à 3 générations, poids > 0, acheteur exclu).
  let eligible = input.gaps
    .filter(
      (g) =>
        g.generationGap >= 0 &&
        g.generationGap < MAX_ROYALTY_GENERATIONS &&
        (weights[g.generationGap] ?? 0) > 0 &&
        g.beneficiaryId !== input.buyerId
    )
    .sort((a, b) => a.generationGap - b.generationGap);

  // Dédoublonnage : un même bénéficiaire ne reçoit qu'une fois (gap le plus proche).
  const seen = new Set<string>();
  eligible = eligible.filter((g) => {
    if (seen.has(g.beneficiaryId)) return false;
    seen.add(g.beneficiaryId);
    return true;
  });

  if (eligible.length === 0) return { commissionCents: commission, shares: [] };

  const totalWeight = () => eligible.reduce((s, g) => s + (weights[g.generationGap] ?? 0), 0);

  let shares: RoyaltyShare[] = eligible.map((g) => ({
    beneficiaryId: g.beneficiaryId,
    generationGap: g.generationGap,
    shareCents: Math.floor((commission * (weights[g.generationGap] ?? 0)) / totalWeight()),
  }));

  // Retirer les parts évanescentes (< 1 centime) et rééquilibrer.
  while (shares.some((s) => s.shareCents < ROYALTY_FLOOR_CENTS) && eligible.length > 1) {
    eligible = eligible.filter((g, idx) => shares[idx]?.shareCents >= ROYALTY_FLOOR_CENTS);
    if (eligible.length === 0) break;
    shares = eligible.map((g) => ({
      beneficiaryId: g.beneficiaryId,
      generationGap: g.generationGap,
      shareCents: Math.floor((commission * (weights[g.generationGap] ?? 0)) / totalWeight()),
    }));
  }

  if (shares.length === 0 || shares.every((s) => s.shareCents < ROYALTY_FLOOR_CENTS)) {
    // Commission trop petite pour être partagée : tout au forkeur si éligible.
    const forkeur = input.gaps.find(
      (g) => g.generationGap === 0 && g.beneficiaryId !== input.buyerId
    );
    if (!forkeur || commission < ROYALTY_FLOOR_CENTS) return { commissionCents: commission, shares: [] };
    return { commissionCents: commission, shares: [{ beneficiaryId: forkeur.beneficiaryId, generationGap: 0, shareCents: commission }] };
  }

  // Distribuer les restes d'arrondi — le forkeur (gap min) en priorité.
  let reste = commission - shares.reduce((s, x) => s + x.shareCents, 0);
  let i = 0;
  while (reste > 0) {
    shares[i % shares.length].shareCents += 1;
    reste -= 1;
    i += 1;
  }

  return { commissionCents: commission, shares };
}