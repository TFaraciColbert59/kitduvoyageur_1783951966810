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
  excellent: 10,
  tres_bon: 15,
  bon: 25,
  moyen: 45,
  use: 65,
  a_remplacer: 90,
  pour_pieces: 100,
};

const CONDITION_LABELS: Record<string, string> = {
  neuf: 'Neuf',
  excellent: 'Excellent état',
  tres_bon: 'Très bon état',
  bon: 'Bon état',
  moyen: 'État correct',
  use: 'Usé',
  a_remplacer: 'À réviser',
  pour_pieces: 'Pour pièces',
};

function normalizeConditionKey(condition?: string | null): string {
  return (condition ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function conditionWear(condition?: string | null): number | null {
  if (!condition) return null;
  const value = CONDITION_WEAR[normalizeConditionKey(condition)];
  return value === undefined ? null : value;
}

export function conditionLabelOf(condition?: string | null): string | null {
  if (!condition?.trim()) return null;
  const key = normalizeConditionKey(condition);
  return CONDITION_LABELS[key] ?? condition.trim();
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
    conditionLabel: conditionLabelOf(item.condition),
    description: null,
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
    conditionLabel: null,
    description: product.description ?? null,
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
      ? 'Gratuit'
      : source === 'location'
        ? `${euros(listing.price_cents)} / jour`
        : euros(listing.price_cents);
  const depositCents =
    source === 'pret'
      ? listing.deposit_cents > 0
        ? listing.deposit_cents
        : listing.price_cents > 0
          ? listing.price_cents
          : 0
      : listing.deposit_cents > 0
        ? listing.deposit_cents
        : null;
  const wear = conditionWear(listing.condition) ?? (source === 'pret' || source === 'occasion' || source === 'location' ? 20 : null);
  const conditionLabel =
    conditionLabelOf(listing.condition) ??
    (source === 'pret' || source === 'occasion' || source === 'location' ? 'Bon état' : null);
  return {
    key: `${source}:${listing.id}`,
    source,
    id: listing.id,
    name: listing.name,
    brand: listing.brand?.trim() || null,
    category: listing.category?.trim() || null,
    weightG: null,
    image: listing.photo_url?.trim() || null,
    wear,
    conditionLabel,
    description: listing.description?.trim() || null,
    priceLabel,
    depositCents,
    owner: listing.owner?.id
      ? {
          id: listing.owner.id,
          name: listing.owner.full_name?.trim() || 'Voyageur LKDV',
          avatarUrl: listing.owner.avatar_url ?? null,
          trustScore: typeof listing.owner.trust_score === 'number' ? listing.owner.trust_score : null,
        }
      : listing.owner_id
        ? {
            id: listing.owner_id,
            name: 'Voyageur LKDV',
            avatarUrl: null,
            trustScore: null,
          }
        : null,
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
