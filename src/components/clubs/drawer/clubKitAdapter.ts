'use client';

import type { KitEntry, KitProductView } from '@/components/compte/drawer/cards/KitCard';

function resolveRealProductImage(name: string, category: string): string {
  const hay = `${name} ${category}`.toLowerCase();
  if (/tente|bivouac|abri|tarp|bâche/.test(hay)) return '/assets/images/product-tent.jpg';
  if (/duvet|couchage|matelas|oreiller/.test(hay)) return '/assets/images/product-sleeping.jpg';
  if (/réchaud|rechaud|popote|cuisine|jetboil/.test(hay)) return '/assets/images/gear-stove.jpg';
  if (/frontale|lampe|éclairage|eclairage|solaire|batterie|gps|inreach/.test(hay)) return '/assets/images/product-headlamp.jpg';
  if (/crampon|chaussure|piolet|bâton|baton|corde|baudrier|dva|casque/.test(hay)) return '/assets/images/gear-boots.jpg';
  if (/veste|doudoune|gore-tex|textile|gant|bonnet/.test(hay)) return '/assets/images/product-jacket.jpg';
  if (/gourde|hydrat|filtre|thermos/.test(hay)) return '/assets/images/product-bottle.jpg';
  if (/secours|pharmacie|couverture/.test(hay)) return '/assets/images/adventure-bivouac.jpg';
  return '/assets/images/product-backpack.jpg';
}
import type { ClubStandardKit } from './ClubDrawerTypes';

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
      condition: null,
      priority: null,
      vital: false,
      brand: null,
      image: resolveRealProductImage(itemName, category),
      description: kit.season ? `Inclus dans ${kit.title} (${kit.season}).` : `Inclus dans ${kit.title}.`,
    };
  });

  return {
    id: kit.id,
    name: kit.title,
    w: kit.totalWeightG,
    total_weight_g: kit.totalWeightG,
    items: count,
    desc: kit.description || (kit.season ? `Kit club · ${kit.season}` : 'Kit officiel du club'),
    products,
  };
}
