import { CART_MAX_QUANTITY_PER_LINE, type CartLine } from '../cartTypes';
import { clampCartQuantity } from '../engine/cartMath';

/**
 * Adaptateur panier local -> panier voyage serveur.
 *
 * Le panier boutique historique vit dans `localStorage` (`src/lib/cart.ts`,
 * clé `kdv_cart`) et n'a pas d'identifiant de voyage. Ce module est le SEUL
 * point de contact entre les deux mondes :
 *
 *   - `planLocalCartImport` transforme des `CartItem` locaux en charges utiles
 *     d'ajout, en écartant ce que le serveur ne peut pas accepter (ids non
 *     UUID = kits/legacy, quantités hors bornes) ;
 *   - `importLocalCartToTrip` pousse ces lignes vers `/api/trips/:id/cart-lines`
 *     et rapporte ce qui a été synchronisé ou ignoré (jamais d'exception
 *     bloquante pour l'UI) ;
 *   - `remoteCartLinesToLocalItems` projette les lignes serveur vers la forme
 *     d'affichage du panier local.
 *
 * Aucun import de `@/lib/cart` ici : l'adaptateur ne dépend que de la forme
 * minimale `LocalCartItemLike`, ce qui évite tout cycle client <-> serveur.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Forme minimale d'un `CartItem` local (cf. `src/lib/cart.ts`). */
export interface LocalCartItemLike {
  id: string;
  slug?: string;
  name: string;
  brand?: string;
  priceEur: number;
  weightG?: number;
  image?: string;
  imageAlt?: string;
  quantity: number;
  category?: string;
}

export interface AddCartLinePayload {
  kind: 'product';
  refId: string;
  quantity: number;
  metadata: Record<string, string | number>;
}

export interface LocalImportPlan {
  payloads: AddCartLinePayload[];
  /** Identifiants ignorés : kits, entrées legacy, références non UUID. */
  skipped: string[];
}

export interface ImportReport {
  synced: number;
  skipped: number;
  failed: string[];
}

export interface CartTransport {
  (url: string, init: { method: string; body: string }): Promise<{ ok: boolean; status: number }>;
}

const UUID_OPTIONS: { cache?: RequestCache; keepalive?: boolean } = {
  cache: 'no-store',
  keepalive: true,
};

export function cartLinesEndpoint(tripId: string): string {
  return '/api/trips/' + encodeURIComponent(tripId) + '/cart-lines';
}

export function cartLineEndpoint(tripId: string, lineId: string): string {
  return cartLinesEndpoint(tripId) + '/' + encodeURIComponent(lineId);
}

export function isServerReferenceId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Convertit un item local en charge utile serveur (quantité bornée). */
export function localItemToAddPayload(item: LocalCartItemLike): AddCartLinePayload | null {
  if (!isServerReferenceId(item.id)) return null;
  const metadata: Record<string, string | number> = { title: item.name };
  if (item.slug) metadata.slug = item.slug;
  if (item.brand) metadata.brand = item.brand;
  if (item.category) metadata.category = item.category;
  if (item.image && /^https?:\/\//i.test(item.image)) metadata.image = item.image;
  if (item.imageAlt) metadata.imageAlt = item.imageAlt;
  if (typeof item.weightG === 'number' && Number.isFinite(item.weightG)) {
    metadata.weightG = Math.max(0, Math.round(item.weightG));
  }
  return {
    kind: 'product',
    refId: item.id,
    quantity: clampCartQuantity(item.quantity),
    metadata,
  };
}

/**
 * Prépare l'import du panier local. Le prix local n'est JAMAIS transmis :
 * le serveur le résout sur `shop_products`.
 */
export function planLocalCartImport(items: readonly LocalCartItemLike[]): LocalImportPlan {
  const payloads: AddCartLinePayload[] = [];
  const skipped: string[] = [];
  for (const item of items) {
    const payload = localItemToAddPayload(item);
    if (payload) payloads.push(payload);
    else skipped.push(item.id);
  }
  return { payloads, skipped };
}

/**
 * Pousse le panier local vers le panier du voyage. Les échecs sont rapportés,
 * pas lancés : le panier local doit rester utilisable hors ligne.
 */
export async function importLocalCartToTrip(
  items: readonly LocalCartItemLike[],
  options: { tripId: string; transport?: CartTransport }
): Promise<ImportReport> {
  const plan = planLocalCartImport(items);
  const transport: CartTransport =
    options.transport ?? ((url, init) => fetch(url, { ...init, ...UUID_OPTIONS }));
  const failed: string[] = [];

  for (const payload of plan.payloads) {
    try {
      const response = await transport(cartLinesEndpoint(options.tripId), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) failed.push(payload.refId);
    } catch {
      failed.push(payload.refId);
    }
  }

  return { synced: plan.payloads.length - failed.length, skipped: plan.skipped.length, failed };
}

/** Projection serveur -> forme d'affichage du panier local. */
export function remoteCartLinesToLocalItems(lines: readonly CartLine[]): LocalCartItemLike[] {
  return lines
    .filter((line) => line.kind === 'product')
    .map((line) => ({
      id: line.refId,
      name: typeof line.metadata.title === 'string' ? line.metadata.title : 'Produit',
      brand: typeof line.metadata.brand === 'string' ? line.metadata.brand : '',
      priceEur: line.unitPriceEur,
      weightG: typeof line.metadata.weightG === 'number' ? line.metadata.weightG : 0,
      image: typeof line.metadata.image === 'string' ? line.metadata.image : '',
      imageAlt: typeof line.metadata.imageAlt === 'string' ? line.metadata.imageAlt : '',
      quantity: clampCartQuantity(line.quantity),
      category: typeof line.metadata.category === 'string' ? line.metadata.category : '',
      slug: typeof line.metadata.slug === 'string' ? line.metadata.slug : undefined,
    }));
}

export { CART_MAX_QUANTITY_PER_LINE };
