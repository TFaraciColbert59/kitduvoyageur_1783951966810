import { createClient } from '@/lib/supabase/server';

export interface KitListItem {
  id: string;
  name: string;
  description: string | null;
  season: string | null;
  total_weight_g: number;
  is_favorite: boolean;
  is_trashed: boolean;
  updated_at: string;
  item_count: number;
  checked_count: number;
  items: { name: string; category: string | null; weight_g: number; quantity: number; product_ownership_id?: string | null }[];
}

/** getKits — kits utilisateur avec stats de complétude (Server-only, RLS). */
export async function getKits(): Promise<KitListItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('materiel_kits')
      .select('id, name, description, season, total_weight_g, is_favorite, is_trashed, updated_at, materiel_kit_items(name, category, weight_g, quantity, is_checked, product_ownership_id)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((k) => {
      const kitItems = (k.materiel_kit_items ?? []) as { name: string; category: string | null; weight_g: number; quantity: number; is_checked: boolean; product_ownership_id: string | null }[];
      return {
        id: k.id,
        name: k.name,
        description: k.description,
        season: k.season,
        total_weight_g: k.total_weight_g ?? 0,
        is_favorite: k.is_favorite,
        is_trashed: k.is_trashed,
        updated_at: k.updated_at,
        item_count: kitItems.length,
        checked_count: kitItems.filter((i) => i.is_checked).length,
        items: kitItems.map((i) => ({
          name: i.name ?? 'Article',
          category: i.category,
          weight_g: i.weight_g ?? 0,
          quantity: i.quantity ?? 1,
          product_ownership_id: i.product_ownership_id,
        })),
      };
    });
  } catch (err) {
    console.error('getKits', err);
    return [];
  }
}
