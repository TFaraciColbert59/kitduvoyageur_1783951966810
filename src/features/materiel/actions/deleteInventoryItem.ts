'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function deleteInventoryItem(itemId: string) {
  if (!itemId || typeof itemId !== 'string') {
    return { success: false, error: 'ID invalide' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    const { error: deleteErr } = await supabase
      .from('product_ownership')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id);

    if (deleteErr) {
      return { success: false, error: deleteErr.message };
    }

    revalidatePath('/materiel');
    revalidatePath('/materiel/inventaire');
    revalidatePath('/materiel/depart');

    return { success: true };
  } catch (err: any) {
    console.error('[deleteInventoryItem]', err);
    return { success: false, error: err?.message || 'Erreur serveur' };
  }
}
