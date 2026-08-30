'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateItemQuantity(itemId: string, quantity: number, kitId?: string) {
  if (!itemId || itemId.length > 100 || quantity < 1 || quantity > 99) {
    return { success: false, error: 'Paramètres invalides' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    const { error } = await supabase
      .from('materiel_kit_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[updateItemQuantity] error', error);
      return { success: false, error: 'Erreur mise à jour' };
    }

    if (kitId) {
      revalidatePath(`/materiel/depart/${kitId}`);
    }
    revalidatePath(`/materiel/depart`);

    return { success: true };
  } catch (err: any) {
    console.error('[updateItemQuantity] unexpected', err);
    return { success: false, error: err?.message || 'Erreur inattendue' };
  }
}
