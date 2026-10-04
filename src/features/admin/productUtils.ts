/**
 * Utilitaires produits — logique pure extraite du legacy (comportement
 * identique, types resserrés : aucun `any`).
 */

export interface ProductVariant {
  id: string;
  size?: string;
  color?: string;
  model?: string;
  sku?: string;
  price?: number;
  stock?: number;
  image?: string;
}

export interface ShopProduct {
  id: string;
  product_id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  category_main: string;
  category_sub: string;
  price_eur: number;
  cost_price_eur?: number;
  vat_rate?: number;
  original_price?: number;
  savings?: number;
  weight_g: number;
  weight_grams: number;
  dimensions: string;
  materials: string;
  warranty: string;
  description_why: string;
  advantages_array: string[];
  disadvantages_array: string[];
  available_europe: boolean;
  available_usa: boolean;
  score_kdv: number;
  essentiality: string;
  cabin_compatible: boolean;
  image: string;
  image_alt: string;
  rating: number;
  review_count: number;
  available: boolean;
  is_active: boolean;
  deleted_at: string | null;
  stock: number;
  min_stock?: number;
  supplier?: string;
  ean?: string;
  tags?: string[];
  variants?: ProductVariant[];
  meta_title?: string;
  meta_description?: string;
  transaction_type: string;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  storage_path: string;
  alt: string;
  is_primary: boolean;
  sort_order: number;
  created_at?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  movement_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

/** Slug FR : minuscules, accents repliés, tirets uniques (legacy, inchangé). */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Export CSV compatible tableur FR (séparateur `;`, UTF-8 + BOM). */
export function buildProductsCsv(products: ShopProduct[]): string {
  const header = ['slug', 'name', 'brand', 'price_eur', 'stock', 'is_active', 'category'];
  const lines = products.map((p) =>
    [
      csvCell(p.slug),
      csvCell(p.name),
      csvCell(p.brand),
      csvCell(p.price_eur),
      csvCell(p.stock),
      csvCell(p.is_active),
      csvCell(p.category),
    ].join(';')
  );
  return `﻿${header.join(';')}\n${lines.join('\n')}`;
}

export function formatPriceEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}
