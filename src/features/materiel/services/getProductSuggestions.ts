import { createClient } from '@/lib/supabase/server';

export interface ProductSuggestion {
  id: string;
  name: string;
  slug: string;
  image: string;
  priceEur: number;
  category: string;
  weightG: number;
}

/** getProductSuggestions — produits boutique pour cross-sell (W-K-10), table shop_products. */
export async function getProductSuggestions(category?: string, limit = 4): Promise<ProductSuggestion[]> {
  try {
    const supabase = await createClient();
    let q = supabase
      .from('shop_products')
      .select('id, slug, name, image, price_eur, category, weight_g')
      .eq('available', true)
      .limit(limit);
    if (category) q = q.eq('category', category);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.image || '/assets/images/no_image.png',
      priceEur: Number(p.price_eur ?? 0),
      category: p.category,
      weightG: p.weight_g ?? 0,
    }));
  } catch (err) {
    console.error('getProductSuggestions', err);
    return [];
  }
}
