/** Logique pure de comparaison de 2 kits — testable, sans I/O. */
import { kitTotalWeight, type KitLine } from './optimizer';

export interface CategoryComparison {
  category: string;
  aG: number;
  bG: number;
}

export interface KitComparison {
  aTotalG: number;
  bTotalG: number;
  deltaG: number;
  deltaPct: number;
  categories: CategoryComparison[];
  common: string[];
  onlyA: string[];
  onlyB: string[];
}

/** Compare 2 kits par catégorie + points communs/écarts (par nom). */
export function compareKits(a: KitLine[], b: KitLine[]): KitComparison {
  const cats = new Set<string>();
  const byCatA = new Map<string, number>();
  const byCatB = new Map<string, number>();

  for (const i of a) { const c = i.category ?? 'Autre'; cats.add(c); byCatA.set(c, (byCatA.get(c) ?? 0) + (i.weight_g || 0) * (i.quantity || 1)); }
  for (const i of b) { const c = i.category ?? 'Autre'; cats.add(c); byCatB.set(c, (byCatB.get(c) ?? 0) + (i.weight_g || 0) * (i.quantity || 1)); }

  const categories = Array.from(cats)
    .map((category) => ({ category, aG: byCatA.get(category) ?? 0, bG: byCatB.get(category) ?? 0 }))
    .sort((x, y) => (y.aG + y.bG) - (x.aG + x.bG));

  const nameA = new Set(a.map((i) => i.name));
  const nameB = new Set(b.map((i) => i.name));
  const common = Array.from(nameA).filter((n) => nameB.has(n)).sort();
  const onlyA = Array.from(nameA).filter((n) => !nameB.has(n)).sort();
  const onlyB = Array.from(nameB).filter((n) => !nameA.has(n)).sort();

  const aTotalG = kitTotalWeight(a);
  const bTotalG = kitTotalWeight(b);
  const deltaG = bTotalG - aTotalG;
  const deltaPct = aTotalG > 0 ? Math.round((deltaG / aTotalG) * 100) : 0;

  return { aTotalG, bTotalG, deltaG, deltaPct, categories, common, onlyA, onlyB };
}
