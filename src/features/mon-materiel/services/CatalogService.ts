'use client';

/**
 * LKDV — Mon Matériel : service catalogue (`shop_products`).
 * Lecture seule (RLS : produits publics actifs), recherche par nom/marque,
 * conversion vers `UnifiedProduct` pour le flux « Ajouter à l'équipement ».
 */

import { createClient } from '@/lib/supabase/client';
import type { UnifiedProduct } from '@/hooks/useEquipment';
import type { CatalogProduct } from '../types/catalog';

type ShopProductRow = CatalogProduct;

export function toUnifiedProduct(row: ShopProductRow): UnifiedProduct {
  return {
    id: row.id,
    slug: row.slug || row.id,
    name: row.name,
    brand: row.brand || '',
    category: row.category || 'Autre',
    category_main: row.category_main || row.category,
    weight_g: Number(row.weight_g ?? row.weight_grams ?? 0),
    price_eur: Number(row.price_eur ?? 0),
    image: row.image || '',
    image_alt: row.image_alt || row.name,
    rating: row.rating,
    review_count: row.review_count,
    essentiality: row.essentiality,
    score_kdv: row.score_kdv,
    description: row.description,
    stock: row.stock,
    is_active: row.is_active,
  };
}

export class CatalogService {
  private supabase = createClient();

  async fetchProducts(limit = 500): Promise<UnifiedProduct[]> {
    const { data, error } = await this.supabase
      .from('shop_products')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(limit);
    if (error) {
      console.warn('[CatalogService] fetchProducts:', error.message);
      return [];
    }
    const rows = (data || []) as unknown as ShopProductRow[];
    return rows.map(toUnifiedProduct);
  }

  /** Recherche plein texte simple par nom ou marque. */
  async search(query: string, limit = 50): Promise<UnifiedProduct[]> {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const { data, error } = await this.supabase
      .from('shop_products')
      .select('*')
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .limit(limit);
    if (error) {
      console.warn('[CatalogService] search:', error.message);
      return [];
    }
    const rows = (data || []) as unknown as ShopProductRow[];
    return rows.map(toUnifiedProduct);
  }
}