import { createClient } from '@/lib/supabase/server';

export interface PublicKit {
  id: string;
  name: string;
  description: string | null;
  total_weight_g: number;
  tags: string[] | null;
  itemsCount: number;
}

/** getPublicKits — kits publics de la communauté (W-K-7), policy materiel_kits_select_own_or_public. */
export async function getPublicKits(): Promise<PublicKit[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('materiel_kits')
      .select('id, name, description, total_weight_g, tags, materiel_kit_items(id)')
      .eq('is_public', true)
      .eq('is_trashed', false)
      .order('updated_at', { ascending: false })
      .limit(12);
    if (error) throw error;

    return (data ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      description: k.description,
      total_weight_g: k.total_weight_g ?? 0,
      tags: k.tags,
      itemsCount: (k.materiel_kit_items ?? []).length,
    }));
  } catch (err) {
    console.error('getPublicKits', err);
    return [];
  }
}
