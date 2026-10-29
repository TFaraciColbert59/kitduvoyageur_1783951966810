import { mapShopProductRow } from '@/hooks/useEquipment';
import type { MarketplaceListing } from '@/features/marketplace/types';
import { asUuid, type KitSource, type PickerProduct } from './types';
import type { InventoryItem } from './kitCompletion';

const euros = (cents: number) => `${Math.round(cents / 100)} €`;

/**
 * Usure d'un objet de l'inventaire, déduite de son état DÉCLARÉ (`product_ownership.condition`) :
 * c'est une échelle qualitative, pas une mesure. Un état absent ou inconnu donne `null` (pas de barre).
 */
const CONDITION_WEAR: Record<string, number> = {
  neuf: 0,
  bon: 25,
  use: 60,
  a_remplacer: 90,
  pour_pieces: 100,
};

export function conditionWear(condition?: string | null): number | null {
  if (!condition) return null;
  const value = CONDITION_WEAR[condition.toLowerCase()];
  return value === undefined ? null : value;
}

export function mapInventoryItem(item: InventoryItem): PickerProduct {
  return {
    key: `inventory:${item.id}`,
    source: 'inventory',
    id: item.id,
    name: item.name,
    brand: null,
    category: item.category?.trim() || null,
    weightG: typeof item.weightG === 'number' && item.weightG > 0 ? item.weightG : null,
    image: item.photoUrl?.trim() || null,
    wear: conditionWear(item.condition),
    priceLabel: null,
    cartable: null,
    ownershipId: asUuid(item.id),
    productId: null,
  };
}

export function mapShopRow(row: unknown): PickerProduct | null {
  const product = mapShopProductRow(row);
  if (!product || product.is_active === false) return null;
  return {
    key: `achat:${product.id}`,
    source: 'achat',
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    weightG: product.weight_g,
    image: product.image,
    wear: null,
    priceLabel: product.price_eur !== null ? `${Math.round(product.price_eur)} €` : null,
    cartable: product.price_eur !== null ? product : null,
    ownershipId: null,
    productId: asUuid(product.id),
  };
}

export function mapListing(
  listing: MarketplaceListing,
  source: Exclude<KitSource, 'inventory' | 'achat'>
): PickerProduct {
  const priceLabel =
    source === 'pret'
      ? 'Prêt gratuit'
      : source === 'location'
        ? `${euros(listing.price_cents)} / jour`
        : euros(listing.price_cents);
  return {
    key: `${source}:${listing.id}`,
    source,
    id: listing.id,
    name: listing.name,
    brand: listing.brand?.trim() || null,
    category: listing.category?.trim() || null,
    weightG: null,
    image: listing.photo_url?.trim() || null,
    wear: null,
    priceLabel,
    cartable: null,
    ownershipId: null,
    productId: null,
  };
}

/** Mode d'annonce de l'API marketplace pour chaque rubrique de la boutique. */
export const LISTING_MODE: Record<'location' | 'occasion' | 'pret', 'location' | 'vente' | 'pret'> =
  {
    location: 'location',
    occasion: 'vente',
    pret: 'pret',
  };

/** Filtre par texte (nom, marque, catégorie), sans accents ni casse. */
export function matchesQuery(product: PickerProduct, query: string): boolean {
  const needle = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!needle) return true;
  const hay = `${product.name} ${product.brand ?? ''} ${product.category ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return hay.includes(needle);
}

/** Découpe en pages de `size` éléments. */
export function chunk<T>(list: readonly T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages;
}
