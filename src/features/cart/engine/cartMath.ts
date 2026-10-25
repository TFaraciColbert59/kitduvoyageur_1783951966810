import {
  CART_MAX_QUANTITY_PER_LINE,
  type CartLine,
  type CartTotals,
} from '../cartTypes';

/** Arrondi monétaire à 2 décimales, sans dépendance externe. */
export function roundEur(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Borne une quantité dans [1, CART_MAX_QUANTITY_PER_LINE]. */
export function clampCartQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(Math.trunc(quantity), 1), CART_MAX_QUANTITY_PER_LINE);
}

/**
 * Totaux du panier. La devise suit la première ligne : le panier est
 * mono-devise côté serveur (l'API refuse tout mélange).
 */
export function computeCartTotals(lines: readonly CartLine[]): CartTotals {
  const itemCount = lines.reduce((sum, line) => sum + clampCartQuantity(line.quantity), 0);
  const totalEur = lines.reduce(
    (sum, line) => sum + roundEur(line.unitPriceEur) * clampCartQuantity(line.quantity),
    0
  );
  return {
    lineCount: lines.length,
    itemCount,
    totalEur: roundEur(totalEur),
    currency: lines[0]?.currency ?? 'EUR',
  };
}
