import type { ChecklistItem } from '../types/trekHub';

/** Calcule le poids total du sac (somme de tous les items). Retourne 0 si vide. */
export function calcBaseWeight(items: ChecklistItem[]): number {
  return items.reduce((sum, item) => {
    const w = item.weight_g ?? 0;
    return sum + (w > 0 ? w : 0);
  }, 0);
}

/** Calcule le % de preparation a partir des items coches. Retourne [0, 100]. */
export function calcReadinessPct(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const checked = items.filter((i) => i.is_checked).length;
  return Math.min(100, Math.max(0, Math.round((checked / items.length) * 100)));
}

/** Derive le statut global a partir du % de preparation. */
export function deriveStatus(readinessPct: number): 'ok' | 'warning' | 'critical' {
  if (readinessPct >= 80) return 'ok';
  if (readinessPct >= 40) return 'warning';
  return 'critical';
}

/** Calcule la repartition du poids par categorie. */
export function calcWeightBreakdown(
  items: ChecklistItem[]
): { category: string; weightG: number; percentage: number }[] {
  const total = calcBaseWeight(items);
  if (total === 0) return [];

  const map = new Map<string, number>();
  for (const item of items) {
    const cat = item.category ?? 'Autre';
    map.set(cat, (map.get(cat) ?? 0) + Math.max(0, item.weight_g ?? 0));
  }

  return Array.from(map.entries())
    .map(([category, weightG]) => ({
      category,
      weightG,
      percentage: Math.round((weightG / total) * 100),
    }))
    .sort((a, b) => b.weightG - a.weightG);
}

/** Formate un poids en grammes en chaine lisible (g ou kg). */
export function formatWeight(grams: number): string {
  if (grams <= 0) return '--';
  if (grams < 1000) return `${grams} g`;
  return `${(grams / 1000).toFixed(1)} kg`;
}
