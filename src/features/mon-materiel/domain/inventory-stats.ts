/**
 * LKDV — Mon Matériel • Domaine : statistiques d'inventaire.
 * Fonctions pures : valeur, poids, répartition par catégorie, état opérationnel.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';

export interface InventoryValueStats {
  totalItems: number;
  totalWeightG: number;
  totalValueEur: number;
  byCategory: Array<{ label: string; count: number; weightG: number; valueEur: number; pct: number }>;
  operationalPct: number;
}

const OPERATIONAL_CONDITIONS: UserEquipmentItem['condition'][] = ['neuf', 'excellent', 'bon', 'moyen', 'usé'];

/** Statistiques agrégées de l'inventaire (poids × quantité, valeur × quantité). */
export function inventoryValueStats(equipment: UserEquipmentItem[]): InventoryValueStats {
  const byCategory = new Map<
    string,
    { label: string; count: number; weightG: number; valueEur: number }
  >();

  let totalWeightG = 0;
  let totalValueEur = 0;
  let operational = 0;

  for (const e of equipment) {
    const qty = e.quantity || 1;
    const weight = (e.weight_g || 0) * qty;
    const value = Number(e.purchase_price || 0) * qty;
    const label = (e.category || 'Autre').split(/[&/]/)[0].trim() || 'Autre';

    totalWeightG += weight;
    totalValueEur += value;

    const bucket = byCategory.get(label) || { label, count: 0, weightG: 0, valueEur: 0 };
    bucket.count += 1;
    bucket.weightG += weight;
    bucket.valueEur += value;
    byCategory.set(label, bucket);

    if (!e.condition || OPERATIONAL_CONDITIONS.includes(e.condition)) operational += 1;
  }

  const categories = Array.from(byCategory.values())
    .sort((a, b) => b.weightG - a.weightG)
    .slice(0, 5)
    .map((c) => ({
      ...c,
      pct: totalWeightG > 0 ? Math.round((c.weightG / totalWeightG) * 100) : 0,
    }));

  return {
    totalItems: equipment.length,
    totalWeightG,
    totalValueEur: Math.round(totalValueEur * 100) / 100,
    byCategory: categories,
    operationalPct:
      equipment.length > 0 ? Math.round((operational / equipment.length) * 100) : 100,
  };
}

/** Mémo: réutilisée par la carte Inventaire & le fullscreen inventaire. */
export function weightAndValue(equipment: UserEquipmentItem[]): {
  totalWeightG: number;
  totalValueEur: number;
} {
  const stats = inventoryValueStats(equipment);
  return { totalWeightG: stats.totalWeightG, totalValueEur: stats.totalValueEur };
}