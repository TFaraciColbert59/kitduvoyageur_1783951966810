'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface AddDepartItemInput {
  kitId: string;
  name: string;
  category: string;
  weightG: number;
  quantity?: number;
  isVital?: boolean;
  addToInventory?: boolean;
}

export async function addDepartItem({
  kitId,
  name,
  category,
  weightG,
  quantity = 1,
  isVital = false,
  addToInventory = false,
}: AddDepartItemInput) {
  if (!kitId || !name || name.trim().length === 0) {
    return { success: false, error: 'Informations incomplètes' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    let ownershipId: string | null = null;

    if (addToInventory) {
      const { data: ownership, error: ownerErr } = await supabase
        .from('product_ownership')
        .insert({
          user_id: user.id,
          name: name.trim(),
          category,
          weight_g: weightG,
          condition: 'excellent',
        })
        .select('id')
        .single();

      if (!ownerErr && ownership) {
        ownershipId = ownership.id;
      }
    }

    const { data: newItem, error: itemErr } = await supabase
      .from('materiel_kit_items')
      .insert({
        kit_id: kitId,
        user_id: user.id,
        name: name.trim(),
        category,
        weight_g: weightG,
        quantity,
        is_checked: false,
        product_ownership_id: ownershipId,
      })
      .select('id, name, category, weight_g, quantity, is_checked')
      .single();

    if (itemErr) {
      console.error('[addDepartItem] error', itemErr);
      return { success: false, error: 'Erreur lors de l’ajout' };
    }

    revalidatePath(`/materiel/depart`);
    revalidatePath(`/materiel/depart/${kitId}`);

    return { success: true, item: newItem };
  } catch (err: any) {
    console.error('[addDepartItem] unexpected', err);
    return { success: false, error: err?.message || 'Erreur inattendue' };
  }
}
