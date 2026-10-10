/**
 * Phase 1 — tarification PURE des commandes (sans IO).
 *
 * Les prix ne viennent QUE du catalogue serveur (`productsBySlug`, issu de
 * `shop_products`) ; le body client ne fournit que des slugs et quantités.
 * `parseOrderBody` valide l'enveloppe et produit des lignes candidates sans
 * prix ; `buildOrderLines` les résout ensuite contre le catalogue (la route
 * enchaîne les deux avant `create_shop_order`).
 */

export type OrderLine = { name: string; slug: string; quantity: number; unitPriceEur: number };

export type CatalogProduct = { id: string; slug: string; name: string; priceEur: number };

export type OrderBody = {
  lines: OrderLine[];
  subtotalEur: number;
  shippingOption: string;
  shipping: Record<string, string>;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const SHIPPING_OPTIONS = new Set(['standard', 'express', 'relay']);
const SLUG_RE = /^[A-Za-z0-9:_-]{1,120}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADDRESS_FIELDS = ['prenom', 'nom', 'email', 'adresse', 'codePostal', 'ville'] as const;
const MAX_FIELD_LENGTH = 200;
const MAX_QUANTITY = 999;
const MAX_ORDER_ITEMS = 50;

/** Barème livraison, miroir de `create_shop_order` : option inconnue → null. */
export function computeShipping(option: string, subtotalEur: number): number | null {
  if (option === 'standard') return subtotalEur >= 99 ? 0 : 5.9;
  if (option === 'express') return 9.9;
  if (option === 'relay') return 3.9;
  return null;
}

/**
 * Résout les articles validés contre le catalogue serveur et calcule le
 * sous-total (borné aux centimes pour éviter toute dérive flottante).
 */
export function buildOrderLines(
  rawItems: unknown,
  productsBySlug: Map<string, CatalogProduct>
): { ok: true; lines: OrderLine[]; subtotalEur: number } | { ok: false; error: string } {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'invalid_items' };
  }

  const candidates: Array<{ slug: string; quantity: number }> = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: 'invalid_items' };
    }
    const { slug, quantity } = item as { slug?: unknown; quantity?: unknown };
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
      return { ok: false, error: 'invalid_items' };
    }
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return { ok: false, error: 'invalid_quantity' };
    }
    if (seen.has(slug)) return { ok: false, error: 'duplicate_product' };
    seen.add(slug);
    candidates.push({ slug, quantity });
  }

  const lines: OrderLine[] = [];
  let subtotal = 0;
  for (const { slug, quantity } of candidates) {
    const product = productsBySlug.get(slug);
    if (!product) return { ok: false, error: 'unknown_product' };
    lines.push({ name: product.name, slug: product.slug, quantity, unitPriceEur: product.priceEur });
    subtotal += product.priceEur * quantity;
  }

  return { ok: true, lines, subtotalEur: Math.round(subtotal * 100) / 100 };
}

/** `{ items 1..999, shippingOption ∈ standard|express|relay, shipping complet }`. */
export function parseOrderBody(input: unknown): ParseResult<OrderBody> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'invalid_body' };
  }
  const body = input as { items?: unknown; shippingOption?: unknown; shipping?: unknown };

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'invalid_items' };
  }
  if (items.length > MAX_ORDER_ITEMS) {
    return { ok: false, error: 'invalid_order' };
  }

  const lines: OrderLine[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: 'invalid_items' };
    }
    const { slug, quantity } = item as { slug?: unknown; quantity?: unknown };
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
      return { ok: false, error: 'invalid_items' };
    }
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return { ok: false, error: 'invalid_quantity' };
    }
    if (seen.has(slug)) return { ok: false, error: 'duplicate_product' };
    seen.add(slug);
    lines.push({ name: slug, slug, quantity, unitPriceEur: 0 });
  }

  const shippingOption = body.shippingOption;
  if (typeof shippingOption !== 'string' || !SHIPPING_OPTIONS.has(shippingOption)) {
    return { ok: false, error: 'invalid_shipping' };
  }

  const shipping = parseShipping(body.shipping);
  if (!shipping.ok) return shipping;

  return { ok: true, value: { lines, subtotalEur: 0, shippingOption, shipping: shipping.value } };
}

function parseShipping(input: unknown): ParseResult<Record<string, string>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'invalid_shipping_address' };
  }
  const record = input as Record<string, unknown>;
  const shipping: Record<string, string> = {};

  for (const field of ADDRESS_FIELDS) {
    const value = record[field];
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_FIELD_LENGTH) {
      return { ok: false, error: 'invalid_shipping_address' };
    }
    shipping[field] = value;
  }

  if (!EMAIL_RE.test(shipping.email)) {
    return { ok: false, error: 'invalid_shipping_address' };
  }

  const pays = record.pays;
  if (typeof pays === 'string' && pays.length > 0) {
    if (pays.length > MAX_FIELD_LENGTH) {
      return { ok: false, error: 'invalid_shipping_address' };
    }
    shipping.pays = pays;
  }

  return { ok: true, value: shipping };
}
