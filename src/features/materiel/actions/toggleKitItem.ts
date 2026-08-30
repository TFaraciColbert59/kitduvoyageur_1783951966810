'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ToggleKitItemResult {
  success: boolean;
  error?: string;
  newChecked?: boolean;
}

/**
 * toggleKitItem — Server Action securise pour cocher/decocher un article de kit.
 *
 * Garanties :
 * - Auth obligatoire (supabase.auth.getUser)
 * - Verification que l item appartient bien au kit de l utilisateur (RLS + user_id)
 * - Revalidation du chemin /materiel/depart apres mutation
 */
export async function toggleKitItem(
  itemId: string,
  currentChecked: boolean
): Promise<ToggleKitItemResult> {
  if (!itemId || typeof itemId !== 'string' || itemId.length > 128) {
    return { success: false, error: 'ID invalide' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Non authentifie' };
    }

    // Verifie que l item appartient a un kit de cet utilisateur (defense en profondeur, RLS active aussi)
    const { data: item, error: fetchError } = await supabase
      .from('materiel_kit_items')
      .select('id, is_checked, materiel_kit_id, materiel_kits!inner(user_id)')
      .eq('id', itemId)
      .maybeSingle();

    if (fetchError || !item) {
      return { success: false, error: 'Article introuvable' };
    }

    const kit = (item as any).materiel_kits;
    if (!kit || kit.user_id !== user.id) {
      return { success: false, error: 'Acces refuse' };
    }

    const newChecked = !currentChecked;

    const { error: updateError } = await supabase
      .from('materiel_kit_items')
      .update({ is_checked: newChecked })
      .eq('id', itemId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/materiel/depart', 'page');
    revalidatePath('/materiel', 'page');

    return { success: true, newChecked };
  } catch (err) {
    console.error('[toggleKitItem]', err);
    return { success: false, error: 'Erreur serveur' };
  }
}
