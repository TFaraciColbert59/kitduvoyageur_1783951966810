import { createClient } from '@/lib/supabase/server';

export interface OccasionProduct {
  id: string;
  name: string;
  slug: string;
  image: string;
  priceEur: number;
  condition: string | null;
}

/** getOccasionProducts — marketplace occasion (shop_products transaction_type='occasion'). */
export async function getOccasionProducts(limit = 4): Promise<OccasionProduct[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('shop_products')
      .select('id, slug, name, image, price_eur, condition')
      .eq('available', true)
      .eq('transaction_type', 'occasion')
      .limit(limit);
    if (error) throw error;

    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.image || '/assets/images/no_image.png',
      priceEur: Number(p.price_eur ?? 0),
      condition: p.condition,
    }));
  } catch (err) {
    console.error('getOccasionProducts', err);
    return [];
  }
}
