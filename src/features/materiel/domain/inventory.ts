export const INVENTORY_STATUSES = {
  en_stock: 'En stock',
  a_acheter: 'À acheter',
  a_louer: 'À louer',
  a_preter: 'À prêter',
  en_location: 'En location',
  en_pret: 'En prêt',
  vendu: 'Vendu',
} as const;
export const INVENTORY_MODES = {
  personnel: 'Personnel',
  vente: 'Vente',
  location: 'Location',
  pret: 'Prêt',
} as const;
export type InventoryStatus = keyof typeof INVENTORY_STATUSES;
export type InventoryMode = keyof typeof INVENTORY_MODES;
type Lifecycle = {
  status?: InventoryStatus | null;
  listing_mode?: InventoryMode | null;
  is_lent?: boolean;
};
export function getInventoryStatus(item: Lifecycle): InventoryStatus {
  return item.status ?? (item.is_lent ? 'en_pret' : 'en_stock');
}
export function allowedInventoryTransitions(item: Lifecycle): InventoryStatus[] {
  const status = getInventoryStatus(item);
  if (status === 'vendu') return [];
  if (status === 'en_location' || status === 'en_pret') return ['en_stock'];
  if (status === 'a_louer' && item.listing_mode === 'location') return ['en_stock', 'en_location'];
  if (status === 'a_preter' && item.listing_mode === 'pret') return ['en_stock', 'en_pret'];
  if (status !== 'en_stock') return ['en_stock'];
  const result: InventoryStatus[] = ['a_acheter'];
  if (item.listing_mode === 'vente') result.push('vendu');
  if (item.listing_mode === 'location') result.push('a_louer', 'en_location');
  if (item.listing_mode === 'pret') result.push('a_preter', 'en_pret');
  return result;
}
export function inventoryValidation(item: {
  serial_number?: string | null;
  quantity?: number;
  listing_mode?: string;
  rental_price_cents?: number | null;
  status?: string;
}): string | null {
  if (item.serial_number && item.quantity !== 1)
    return 'Un objet sérialisé doit avoir une quantité de 1';
  if (item.listing_mode === 'location' && !(Number(item.rental_price_cents) > 0))
    return 'Le tarif de location doit être positif';
  if (
    (item.status === 'a_louer' || item.status === 'en_location') &&
    item.listing_mode !== 'location'
  )
    return 'Mode incompatible avec la location';
  if ((item.status === 'a_preter' || item.status === 'en_pret') && item.listing_mode !== 'pret')
    return 'Mode incompatible avec le prêt';
  if (item.status === 'vendu' && item.listing_mode !== 'vente')
    return 'Mode incompatible avec la vente';
  return null;
}

/** Possession et disponibilité sont distinctes : une location engagée reste possédée. */
export function isInventoryAvailable(item: Lifecycle): boolean {
  return !['a_acheter', 'en_location', 'en_pret', 'vendu'].includes(getInventoryStatus(item));
}
