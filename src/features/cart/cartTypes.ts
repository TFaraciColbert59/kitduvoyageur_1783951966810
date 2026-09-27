/**
 * Panier voyage LKDV — types domaine partagés (client + serveur).
 *
 * Le panier est un objet composite : lignes `product` (boutique) et
 * `booking` (réservation fournisseur). Chaque ligne appartient à un
 * utilisateur ET à un voyage : la clé métier est
 * (user_id, trip_id, kind, ref_id), garantie unique en base
 * (`cart_lines_owner_trip_kind_ref_uniq`).
 *
 * Prix : `unitPriceEur` est TOUJOURS résolu côté serveur depuis la source de
 * vérité (`shop_products` ou `bookings`). Le client ne propose jamais de prix
 * — il propose une quantité et un libellé d'affichage.
 */

export const CART_LINE_KINDS = ['product', 'booking'] as const;
export type CartLineKind = (typeof CART_LINE_KINDS)[number];

/** Valeurs autorisées dans `cart_lines.metadata` (jsonb). Plat uniquement. */
export type CartMetadataValue = string | number | boolean | null;
export type CartLineMetadata = Record<string, CartMetadataValue>;

export interface CartLine {
  id: string;
  userId: string;
  tripId: string;
  kind: CartLineKind;
  refId: string;
  quantity: number;
  unitPriceEur: number;
  currency: string;
  metadata: CartLineMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface CartTotals {
  /** Nombre de lignes distinctes. */
  lineCount: number;
  /** Somme des quantités. */
  itemCount: number;
  totalEur: number;
  currency: string;
}

/** Garde-fou quantité : au-delà, la ligne est refusée. */
export const CART_MAX_QUANTITY_PER_LINE = 99;
/** Garde-fou volume : au-delà, la lecture est refusée plutôt que d'exploser. */
export const CART_MAX_LINES = 200;
/** Clé réservée dans `metadata` pour l'idempotence d'ajout. */
export const CART_IDEMPOTENCY_METADATA_KEY = 'idempotencyKey';

export function isCartLineKind(value: unknown): value is CartLineKind {
  return typeof value === 'string' && (CART_LINE_KINDS as readonly string[]).includes(value);
}
