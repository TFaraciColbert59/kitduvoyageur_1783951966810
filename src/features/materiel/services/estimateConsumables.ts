/**
 * Estimation automatique des consommables selon la durée en jours et le nombre de participants.
 */
export function estimateConsumables(days: number, pax: number): {
  water: number;
  gas: number;
  meals: number;
  snacks: number;
} {
  const d = Math.max(1, Math.round(days) || 1);
  const p = Math.max(1, Math.round(pax) || 1);
  return {
    water: Math.round(d * p * 2.5 * 10) / 10,
    gas: d * 60 * p,
    meals: d * p * 2,
    snacks: d * p * 2,
  };
}
