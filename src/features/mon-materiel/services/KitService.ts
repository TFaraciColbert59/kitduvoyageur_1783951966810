'use client';

/**
 * LKDV — Mon Matériel : service kits (helpers purs autour de `useUserKits`).
 * Les mutations de kits restent portées par le hook `useUserKits` (RLS OK) ;
 * ce service expose les projections utilisées par le domaine (membership,
 * engagement départ, auto-complétion).
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit, CustomKitItem } from '@/hooks/useUserKits';

/** Ids d'équipement présents dans tous les kits actifs. */
export function kitMembershipIds(kits: CustomKit[]): string[] {
  const ids = new Set<string>();
  for (const kit of kits) {
    for (const item of kit.items || []) {
      if (item.gear_item_id) ids.add(item.gear_item_id);
    }
  }
  return Array.from(ids);
}

/** Ids d'équipement engagés par le kit assigné au prochain départ. */
export function hikeCommittedGearIds(kit: CustomKit | null): string[] {
  if (!kit) return [];
  return (kit.items || [])
    .map((i) => i.gear_item_id)
    .filter((id): id is string => Boolean(id));
}

/** Articles du kit non encore liés à un objet d'inventaire possédé. */
export function unmatchedKitItems(
  kit: CustomKit | null,
  equipment: UserEquipmentItem[]
): CustomKitItem[] {
  if (!kit) return [];
  return (kit.items || []).filter((item) => {
    if (item.gear_item_id) {
      return !equipment.some((e) => e.id === item.gear_item_id);
    }
    return !equipment.some(
      (e) => e.name.trim().toLowerCase() === (item.item_name || '').trim().toLowerCase()
    );
  });
}

/** Auto-complète un kit : associe les articles sans gear_item_id à l'inventaire, par nom. */
export function autoLinkKitItems(
  kit: CustomKit,
  equipment: UserEquipmentItem[]
): Array<{ item: CustomKitItem; gear: UserEquipmentItem }> {
  const links: Array<{ item: CustomKitItem; gear: UserEquipmentItem }> = [];
  for (const item of kit.items || []) {
    if (item.gear_item_id) continue;
    const gear = equipment.find(
      (e) => e.name.trim().toLowerCase() === (item.item_name || '').trim().toLowerCase()
    );
    if (gear) links.push({ item, gear });
  }
  return links;
}

/** Score d'usage d'un kit (somme des usage_count de ses articles liés). */
export function kitUsageScore(kit: CustomKit, equipment: UserEquipmentItem[]): number {
  const byId = new Map(equipment.map((e) => [e.id, e]));
  return (kit.items || []).reduce((sum, i) => {
    const gear = i.gear_item_id ? byId.get(i.gear_item_id) : undefined;
    return sum + (gear?.usage_count || 0);
  }, 0);
}

/** Kit le plus utilisé de la liste. */
export function mostUsedKit(kits: CustomKit[], equipment: UserEquipmentItem[]): CustomKit | null {
  if (kits.length === 0) return null;
  return [...kits].sort((a, b) => kitUsageScore(b, equipment) - kitUsageScore(a, equipment))[0];
}

/** Kits jamais utilisés (aucun usage, jamais assignés à un départ récent). */
export function neverUsedKits(kits: CustomKit[]): CustomKit[] {
  return kits.filter((k) => !k.last_used_at);
}

/** Payload de duplication d'un kit (consommable par createKit de useUserKits). */
export function duplicateKitPayload(
  kit: CustomKit
): {
  name: string;
  description: string;
  for_destination: string;
  season: string;
  activity: string;
  source: 'manuel';
  gearItems: Array<{
    gear_item_id?: string | null;
    item_name?: string;
    category: string;
    weight_g: number;
    quantity: number;
    is_essential: boolean;
  }>;
} {
  return {
    name: `${kit.name} (copie)`,
    description: kit.description || '',
    for_destination: kit.for_destination || '',
    season: kit.season || '',
    activity: kit.activity || 'randonnee',
    source: 'manuel',
    gearItems: (kit.items || []).map((i) => ({
      gear_item_id: i.gear_item_id,
      item_name: i.item_name,
      category: i.category || 'Autre',
      weight_g: i.weight_g || 0,
      quantity: i.quantity || 1,
      is_essential: Boolean(i.is_essential),
    })),
  };
}

/** Suggère un kit pour un départ : le kit assigné, sinon le plus complet, sinon le premier. */
export function suggestForDeparture(
  kits: CustomKit[],
  assignedKitId: string | undefined | null,
  equipment: UserEquipmentItem[]
): CustomKit | null {
  if (kits.length === 0) return null;
  if (assignedKitId) {
    const found = kits.find((k) => k.id === assignedKitId);
    if (found) return found;
  }
  const completeness = (kit: CustomKit): number => {
    const items = kit.items || [];
    if (items.length === 0) return 0;
    const owned = items.filter((i) => {
      if (i.gear_item_id) return equipment.some((e) => e.id === i.gear_item_id);
      return equipment.some((e) => e.name.trim().toLowerCase() === (i.item_name || '').trim().toLowerCase());
    }).length;
    return owned / items.length;
  };
  return [...kits].sort((a, b) => completeness(b) - completeness(a))[0];
}