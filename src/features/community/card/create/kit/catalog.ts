import { mapShopProductRow, type UserEquipmentItem } from '@/hooks/useEquipment';
import { wearPercent } from '@/components/compte/drawer/cards/WearGauge';
import type { MarketplaceListing } from '@/features/marketplace/types';
import { asUuid, type KitSource, type PickerProduct } from './types';

const euros = (cents: number) => `${Math.round(cents / 100)} €`;

/** Usure : la valeur enregistrée sinon celle dérivée des sorties ; jamais une valeur par défaut. */
export function inventoryWear(
  item: Pick<UserEquipmentItem, 'wear_percentage' | 'usage_count'>
): number | null {
  if (typeof item.wear_percentage === 'number' && Number.isFinite(item.wear_percentage)) {
    return Math.max(0, Math.min(100, Math.round(item.wear_percentage)));
  }
  return wearPercent(item.usage_count);
}

export function mapInventoryRow(row: UserEquipmentItem): PickerProduct {
  const weight = typeof row.weight_g === 'number' && row.weight_g > 0 ? row.weight_g : null;
  return {
    key: `inventory:${row.id}`,
    source: 'inventory',
    id: row.id,
    name: row.name,
    brand: row.brand?.trim() || null,
    category: row.category?.trim() || null,
    weightG: weight,
    image: row.image?.trim() || null,
    wear: inventoryWear(row),
    priceLabel: null,
    cartable: null,
    ownershipId: asUuid(row.id),
    productId: asUuid(row.product_id),
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
