'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function deleteDepartItem(itemId: string, kitId?: string) {
  if (!itemId || itemId.length > 100) {
    return { success: false, error: 'ID invalide' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    const { error } = await supabase
      .from('materiel_kit_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[deleteDepartItem] error', error);
      return { success: false, error: 'Erreur lors de la suppression' };
    }

    if (kitId) {
      revalidatePath(`/materiel/depart/${kitId}`);
    }
    revalidatePath(`/materiel/depart`);

    return { success: true };
  } catch (err: any) {
    console.error('[deleteDepartItem] unexpected', err);
    return { success: false, error: err?.message || 'Erreur inattendue' };
  }
}
