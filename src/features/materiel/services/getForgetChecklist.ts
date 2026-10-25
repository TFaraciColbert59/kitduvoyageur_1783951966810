import { createClient } from '@/lib/supabase/server';

export interface ForgetItem {
  id: string;
  kitId: string;
  name: string;
  is_checked: boolean;
}

/** getForgetChecklist — articles du premier kit actif (« à ne pas oublier »). */
export async function getForgetChecklist(): Promise<ForgetItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: kit, error } = await supabase
      .from('materiel_kits')
      .select('id, materiel_kit_items(id, name, is_checked)')
      .eq('user_id', user.id)
      .eq('is_trashed', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !kit) return [];

    return (kit.materiel_kit_items ?? [])
      .map((i: { id: string; name: string | null; is_checked: boolean }) => ({
        id: i.id,
        kitId: kit.id,
        name: i.name ?? 'Article',
        is_checked: i.is_checked,
      }));
  } catch (err) {
    console.error('getForgetChecklist', err);
    return [];
  }
}
