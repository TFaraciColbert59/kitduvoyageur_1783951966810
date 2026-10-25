/**
 * T40 — Pool de contribution FINANCÉ : distribution en centimes au gel d'une
 * période, au prorata des parts éligibles, plancher par bénéficiaire, résidus
 * tracés dans la réserve. Un pool nul ou non financé ne distribue RIEN.
 * Plafonds publiés : 50 parts/semaine et 200 parts/période.
 */

export const PARTS_WEEKLY_CAP = 50;
export const PARTS_PERIOD_CAP = 200;

export interface PoolAllocationInput {
  /** Pool disponible en centimes (marges encaissées et/ou financement reçu). */
  poolCents: number;
  /** Parts éligibles par bénéficiaire (déjà plafonnées côté émission). */
  eligibleShares: ReadonlyArray<{ userId: string; shares: number }>;
}

export interface PoolAllocation {
  allocations: Array<{ userId: string; cents: number }>;
  /** Centimes résiduels (arrondis) → réserve, jamais perdus. */
  reserveCents: number;
  /** Pool nul → aucune valeur distribuable. */
  distributable: boolean;
}

export function allocatePool(input: PoolAllocationInput): PoolAllocation {
  const pool = Math.max(0, Math.floor(input.poolCents));
  const totalShares = input.eligibleShares.reduce(
    (sum, entry) => sum + Math.max(0, Math.floor(entry.shares)),
    0
  );

  if (pool <= 0 || totalShares <= 0) {
    return { allocations: [], reserveCents: pool, distributable: false };
  }

  const allocations: Array<{ userId: string; cents: number }> = [];
  let distributed = 0;
  for (const entry of input.eligibleShares) {
    const shares = Math.max(0, Math.floor(entry.shares));
    if (shares <= 0) continue;
    const cents = Math.floor((pool * shares) / totalShares);
    allocations.push({ userId: entry.userId, cents });
    distributed += cents;
  }

  return {
    allocations,
    reserveCents: pool - distributed,
    distributable: distributed > 0,
  };
}

/** Plafond proposé d'une période : min(cap période, cap hebdo × semaines). */
export function periodCapForShares(weeks: number): number {
  return Math.min(PARTS_PERIOD_CAP, PARTS_WEEKLY_CAP * Math.max(1, Math.floor(weeks)));
}
