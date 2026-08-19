/**
 * LKDV — Mon Matériel • Domaine : flux commande → réception → inventaire.
 * Fonctions pures qui transforment une ligne de commande en fiche d'inventaire
 * et qui préparent le rattachement à la destination (kit, checklist, départ).
 * L'écriture Supabase (insert) reste du ressort des services.
 */

import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { UnifiedProduct } from '@/hooks/useEquipment';
import type { GearDestination, OrderedProductItem } from '../types/gear';
import type { GearHistoryEvent } from '../types/gear';

/** Réception : tuple (objet à insérer, événements d'historique à écrire). */
export interface ReceptionResult {
  gear: UserEquipmentItem;
  history: GearHistoryEvent[];
  destinationSummary?: string;
}

/** Statuts de commande considérés comme « en cours » (affichés dans En commande). */
export const ON_ORDER_STATUSES = ['pending', 'processing', 'paid', 'shipped', 'awaiting_reception'];

/**
 * Normalise une ligne `order_items` Supabase en OrderedProductItem.
 * @param row champ d'une ligne (voir src/app/api/stripe/webhook/route.ts)
 */
export function toOrderedProductItem(
  row: {
    id: string;
    order_id: string;
    product_id?: string | null;
    product_slug?: string;
    product_name?: string;
    product_brand?: string;
    quantity?: number;
    unit_price_eur?: number;
    created_at?: string | null;
  },
  orderStatus?: string | null,
  destination?: GearDestination
): OrderedProductItem {
  return {
    orderId: row.order_id,
    orderItemId: row.id,
    productId: row.product_id || null,
    slug: row.product_slug || '',
    name: row.product_name || 'Article',
    brand: row.product_brand || '',
    quantity: row.quantity || 1,
    priceEur: Number(row.unit_price_eur || 0),
    status: orderStatus || 'pending',
    createdAt: row.created_at || null,
    destination,
  };
}

/**
 * Construit l'objet d'inventaire à créer à la réception d'une ligne commandée.
 * `source` reste 'achat' (valeur acceptée par le CHECK de gear_items).
 */
export function buildReceptionGear(
  ordered: OrderedProductItem,
  product: UnifiedProduct | null
): UserEquipmentItem {
  return {
    id: crypto.randomUUID(),
    user_id: '',
    product_id: product?.id || ordered.productId || null,
    name: ordered.name,
    brand: ordered.brand || product?.brand || null,
    category: product?.category_main || product?.category || 'Autre',
    weight_g: product?.weight_g ?? ordered.weightG ?? 0,
    purchase_price: ordered.priceEur ?? product?.price_eur ?? null,
    image: product?.image || null,
    condition: 'neuf',
    source: 'achat',
    quantity: ordered.quantity || 1,
    is_favorite: false,
    is_listed_for_sale: false,
    acquired_at: new Date().toISOString().split('T')[0],
    notes: ordered.destination?.reason
      ? `Reçu via commande — ${ordered.destination.reason}`
      : 'Reçu via commande.',
    usage_count: 0,
    loan_status: 'disponible',
    loan_to_name: null,
  };
}

/** Résumé lisible de la destination mémorisée (kit, checklist, départ). */
export function destinationSummary(destination?: GearDestination): string | undefined {
  if (!destination) return undefined;
  switch (destination.type) {
    case 'kit':
      return destination.label ? `Rattachement au kit « ${destination.label} » à confirmer` : 'Rattachement au kit à confirmer';
    case 'departure':
      return destination.label ? `Préparé pour « ${destination.label} »` : 'Destiné au prochain départ';
    case 'checklist':
      return 'Ajouté à la checklist de préparation';
    case 'inventory':
    default:
      return undefined;
  }
}

/** Événements d'historique à écrire lors de la réception. */
export function buildReceptionHistory(
  ordered: OrderedProductItem,
  destination?: GearDestination
): GearHistoryEvent[] {
  const ts = new Date().toISOString();
  const events: GearHistoryEvent[] = [];
  const summary = destinationSummary(destination);
  events.push({
    id: crypto.randomUUID(),
    gear_item_id: '',
    event_type: 'acquisition',
    event_date: ts,
    notes: `Commande ${ordered.orderId} — réception confirmée${summary ? ` · ${summary}` : ''}.`,
  });
  return events;
}

/** Vrai si le produit (nom/modèle) est déjà présent dans l'inventaire (doublon). */
export function hasDuplicate(
  product: { name: string; brand?: string; id?: string },
  equipment: UserEquipmentItem[]
): boolean {
  const name = product.name.trim().toLowerCase();
  return equipment.some(
    (e) =>
      (product.id && (e.product_id === product.id || e.id === product.id)) ||
      e.name.trim().toLowerCase() === name
  );
}

/** Colonnes manquantes détectées (audit du schéma, utilisation dans le journal). */
export const GEAR_SCHEMA_NOTES = {
  extraColumns: [
    'quantity', 'is_favorite', 'loan_status', 'loan_to_name',
    'wear_percentage', 'size_label', 'materials', 'sole_type',
    'waterproof_rating', 'ref_code',
  ],
  sourceCheck: "source IN ('achat','kit','manuel','occasion', 'catalogue') → à étendre",
} as const;