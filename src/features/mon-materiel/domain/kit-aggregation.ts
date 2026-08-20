/**
 * LKDV — Mon Matériel • Domaine : agrégation des kits.
 * Fonctions pures : progression par kit, répartition du poids par catégorie,
 * usage des kits, kits jamais utilisés.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit, CustomKitItem } from '@/hooks/useUserKits';

export interface KitProgress {
  kitId: string;
  kitName: string;
  ownedCount: number;
  totalCount: number;
  completenessPct: number;
  missingCount: number;
}

/** Progression de possession de chaque kit (possédé vs total d'articles). */
export function aggregateKitProgress(
  kits: CustomKit[],
  equipment: UserEquipmentItem[]
): KitProgress[] {
  return kits.map((kit) => {
    const items = kit.items || [];
    const owned = items.filter((i) => {
      if (i.gear_item_id) return equipment.some((e) => e.id === i.gear_item_id);
      return equipment.some((e) => e.name.trim().toLowerCase() === (i.item_name || '').trim().toLowerCase());
    }).length;
    const total = items.length;
    return {
      kitId: kit.id,
      kitName: kit.name,
      ownedCount: owned,
      totalCount: total,
      missingCount: total - owned,
      completenessPct: total > 0 ? Math.round((owned / total) * 100) : 0,
    };
  });
}

/** Répartition du poids (g) d'un kit par catégorie d'article. */
export function weightByCategory(kit: CustomKit | null): Array<{ label: string; grams: number; pct: number }> {
  const items = kit?.items || [];
  const map = new Map<string, number>();
  for (const i of items) {
    const label = (i.category || 'Autre').split(/[&/]/)[0].trim() || 'Autre';
    map.set(label, (map.get(label) || 0) + (i.weight_g || 0) * (i.quantity || 1));
  }
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(map.entries())
    .map(([label, grams]) => ({ label, grams, pct: Math.round((grams / total) * 100) }))
    .sort((a, b) => b.grams - a.grams);
}

/** Score d'usage d'un kit : somme des usages connus de ses articles réels. */
export function kitUsageScore(kit: CustomKit, equipment: UserEquipmentItem[]): number {
  const byId = new Map(equipment.map((e) => [e.id, e]));
  return (kit.items || []).reduce((sum, i) => {
    const gear = i.gear_item_id ? byId.get(i.gear_item_id) : undefined;
    return sum + (gear?.usage_count || 0);
  }, 0);
}

/** Kit le plus utilisé (score d'usage des articles liés). */
export function mostUsedKit(kits: CustomKit[], equipment: UserEquipmentItem[]): CustomKit | null {
  if (kits.length === 0) return null;
  return [...kits].sort((a, b) => kitUsageScore(b, equipment) - kitUsageScore(a, equipment))[0];
}

/** Kits jamais utilisés (aucun article avec sorties_count / usage_count > 0). */
export function neverUsedKits(kits: CustomKit[], equipment: UserEquipmentItem[]): CustomKit[] {
  return kits.filter((k) => kitUsageScore(k, equipment) === 0 && (k.last_used_at == null || k.updated_at == null));
}

/** Articles manquants du kit pour un départ (possession de l'inventaire). */
export function missingKitItems(
  kit: CustomKit,
  equipment: UserEquipmentItem[]
): CustomKitItem[] {
  return (kit.items || []).filter((i) => {
    if (i.gear_item_id) return !equipment.some((e) => e.id === i.gear_item_id);
    return !equipment.some((e) => e.name.trim().toLowerCase() === (i.item_name || '').trim().toLowerCase());
  });
}