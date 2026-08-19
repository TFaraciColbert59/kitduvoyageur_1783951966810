/**
 * LKDV — Mon Matériel • Domaine : complétude d'un kit / d'un départ.
 * Calcule, pour chaque article d'un kit : possédé ? disponible ? et les
 * substituts possibles dans l'inventaire. Fonctions pures.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit, CustomKitItem } from '@/hooks/useUserKits';
import type { GearStatusContext } from '../types/gear';
import { computeGearAvailability } from './gear-availability';
import { pct } from './gear-format';

export interface KitItemAssessment {
  item: CustomKitItem;
  gear?: UserEquipmentItem;
  owned: boolean;
  available: boolean;
  reason?: string;
}

export interface KitCompleteness {
  totalItems: number;
  ownedCount: number;
  availableCount: number;
  unavailableCount: number;
  missingCount: number;
  completenessPct: number; // % possédé
  availabilityPct: number; // % prêt (disponible) pour le départ
  missingItems: CustomKitItem[];
  unavailableItems: KitItemAssessment[];
  assessments: KitItemAssessment[];
}

function findGearForItem(equipment: UserEquipmentItem[], item: CustomKitItem): UserEquipmentItem | undefined {
  if (item.gear_item_id) {
    const byId = equipment.find((e) => e.id === item.gear_item_id);
    if (byId) return byId;
  }
  return equipment.find(
    (e) => e.name.trim().toLowerCase() === (item.item_name || '').trim().toLowerCase()
  );
}

export function assessKitItem(
  item: CustomKitItem,
  equipment: UserEquipmentItem[],
  ctx: GearStatusContext = {}
): KitItemAssessment {
  const gear = findGearForItem(equipment, item);
  if (!gear) {
    return { item, owned: false, available: false, reason: 'Objet absent de l’inventaire' };
  }
  const availability = computeGearAvailability(gear, ctx);
  return {
    item,
    gear,
    owned: true,
    available: availability.available,
    reason: availability.available ? undefined : availability.reasonLabel,
  };
}

/**
 * Nombre d'articles correspondants présents ET disponibles dans l'inventaire
 * pour un article de kit (catalogue/kit). Utilisé par les checklists pour
 * afficher `{available}/{required}`.
 */
export function countKitItemStock(
  item: CustomKitItem,
  equipment: UserEquipmentItem[],
  ctx: GearStatusContext = {}
): { available: number; required: number; total: number } {
  const required = Math.max(1, item.quantity || 1);
  const matches = equipment.filter((e) =>
    item.gear_item_id
      ? e.id === item.gear_item_id
      : e.name.trim().toLowerCase() === (item.item_name || '').trim().toLowerCase()
  );
  const total = matches.reduce((sum, e) => sum + Math.max(1, e.quantity || 1), 0);
  const available = matches
    .filter((e) => computeGearAvailability(e, ctx).available)
    .reduce((sum, e) => sum + Math.max(1, e.quantity || 1), 0);
  return { available, required, total };
}

export function evaluateKitCompleteness(
  kit: CustomKit,
  equipment: UserEquipmentItem[],
  ctx: GearStatusContext = {}
): KitCompleteness {
  const items = kit.items || [];
  const assessments = items.map((item) => assessKitItem(item, equipment, ctx));

  const ownedCount = assessments.filter((a) => a.owned).length;
  const availableCount = assessments.filter((a) => a.available).length;
  const unavailableCount = assessments.filter((a) => a.owned && !a.available).length;
  const missingCount = assessments.filter((a) => !a.owned).length;

  return {
    totalItems: items.length,
    ownedCount,
    availableCount,
    unavailableCount,
    missingCount,
    completenessPct: pct(ownedCount, items.length),
    availabilityPct: pct(availableCount, items.length),
    missingItems: assessments.filter((a) => !a.owned).map((a) => a.item),
    unavailableItems: assessments.filter((a) => a.owned && !a.available),
    assessments,
  };
}

/** Candidats de substitution par catégorie (jamais l'objet lui-même, jamais à remplacer). */
export function findSubstitutes(
  item: CustomKitItem,
  equipment: UserEquipmentItem[],
  excludedGearId?: string
): UserEquipmentItem[] {
  const cat = (item.category || '').toLowerCase().trim();
  return equipment.filter((g) => {
    if (excludedGearId && g.id === excludedGearId) return false;
    if (g.condition === 'à_remplacer' || g.loan_status === 'prêté') return false;
    const gCat = (g.category || '').toLowerCase().trim();
    return cat !== '' && gCat.includes(cat);
  }).sort((a, b) => (b.weight_g || 0) - (a.weight_g || 0));
}

/** Poids total d'un kit (recalculé depuis les articles si la colonne manque). */
export function kitTotalWeight(kit: CustomKit): number {
  if (kit.total_weight_g && kit.total_weight_g > 0) return kit.total_weight_g;
  return (kit.items || []).reduce((sum, i) => sum + (i.weight_g || 0) * (i.quantity || 1), 0);
}