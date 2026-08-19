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