'use client';

import type { KitEntry, KitProductView } from '@/components/compte/drawer/cards/KitCard';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import type { ClubStandardKitData } from './ClubDrawerTypes';

function inferCategoryFromLabel(label: string): string {
  const s = label.toLowerCase();
  if (/tente|abri|bivouac|tarp|bâche/.test(s)) return 'Bivouac & Abri';
  if (/duvet|sac de couchage|matelas|oreiller/.test(s)) return 'Couchage';
  if (/réchaud|popote|filtre|gourde|thermos|cuisine/.test(s)) return 'Cuisine';
  if (/frontale|lampe|batterie|solaire|gps|inreach/.test(s)) return 'Électronique';
  if (/corde|baudrier|crampon|piolet|dva|sonde|pelle|casque|mousqueton/.test(s)) return 'Alpinisme & Sécu';
  if (/sac à dos|sac |bâton/.test(s)) return 'Portage';
  if (/veste|gore-tex|doudoune|gant|bonnet|chaussette/.test(s)) return 'Vêtements';
  if (/secours|pharmacie|couverture/.test(s)) return 'Sécurité';
  return 'Équipement';
}

/**
 * Convertit un kit standard de club (`ClubStandardKitData`) ou un résumé de kit
 * issu des statistiques vers le format `KitEntry` du drawer Profil / Carnet.
 */
export function mapClubStandardKitToKitEntry(kit: {
  id: string;
  title: string;
  season?: string | null;
  totalWeightG: number;
  itemsCount?: number;
  items?: string[];
  description?: string | null;
}): KitEntry {
  const itemNames = Array.isArray(kit.items) ? kit.items.filter(Boolean) : [];
  const count = Math.max(kit.itemsCount ?? 0, itemNames.length);
  const perItemWeight = count > 0 && kit.totalWeightG > 0 ? Math.round(kit.totalWeightG / count) : null;

  const products: KitProductView[] = itemNames.map((itemName, idx) => {
    const category = inferCategoryFromLabel(itemName);
    return {
      id: `${kit.id}-item-${idx}`,
      name: itemName,
      category,
      quantity: 1,
      weightG: perItemWeight,
      image: generatedProductImage(itemName, 96),
      description: kit.season ? `Inclus dans ${kit.title} (${kit.season}).` : `Inclus dans ${kit.title}.`,
    };
  });

  return {
    id: kit.id,
    name: kit.title,
    weight_g: kit.totalWeightG,
    weight: kit.totalWeightG,
    desc: kit.description || (kit.season ? `Kit club · ${kit.season}` : 'Kit officiel du club'),
    products,
    wear: 18,
  };
}
