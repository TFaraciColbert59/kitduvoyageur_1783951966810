import type { UnifiedProduct } from '@/hooks/useEquipment';

/** D'où vient le produit proposé dans le sélecteur du kit. */
export type KitSource = 'inventory' | 'achat' | 'location' | 'occasion' | 'pret';

/** Rubriques de la boutique (sous-sélecteur) : achat neuf, location, occasion, prêt. */
export const SHOP_SOURCES: ReadonlyArray<{ id: Exclude<KitSource, 'inventory'>; label: string }> = [
  { id: 'achat', label: 'Achat' },
  { id: 'location', label: 'Location' },
  { id: 'occasion', label: 'Occasion' },
  { id: 'pret', label: 'Prêt' },
];

/** Un produit tel que le sélecteur l'affiche, quelle que soit sa source. */
export interface PickerProduct {
  key: string;
  source: KitSource;
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  weightG: number | null;
  image: string | null;
  /** Usure en % (inventaire seulement, jamais inventée) ; `null` = inconnue. */
  wear: number | null;
  /** Prix lisible (« 129 € », « 12 € / jour », « Prêt gratuit »), `null` si inconnu. */
  priceLabel: string | null;
  /** Produit du catalogue : seul celui-ci peut aller au panier. */
  cartable: UnifiedProduct | null;
  /** Lignes de `materiel_kit_items` à écrire. */
  ownershipId: string | null;
  productId: string | null;
}

/** Un bloc rempli du kit (sérialisable : il vit dans le brouillon local). */
export interface KitSlot {
  key: string;
  source: KitSource;
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  weightG: number | null;
  image: string | null;
  ownershipId: string | null;
  productId: string | null;
}

export function toSlot(product: PickerProduct): KitSlot {
  return {
    key: `${product.key}-${Date.now().toString(36)}`,
    source: product.source,
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    weightG: product.weightG,
    image: product.image,
    ownershipId: product.ownershipId,
    productId: product.productId,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const asUuid = (value: unknown): string | null =>
  typeof value === 'string' && UUID.test(value) ? value : null;

/** Poids total connu (g) et nombre d'articles dont le poids manque. */
export function summarizeSlots(slots: readonly KitSlot[]): { weightG: number; unknown: number } {
  let weightG = 0;
  let unknown = 0;
  for (const slot of slots) {
    if (slot.weightG && slot.weightG > 0) weightG += slot.weightG;
    else unknown += 1;
  }
  return { weightG, unknown };
}
