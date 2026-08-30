'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface AddInventoryItemInput {
  name: string;
  brand?: string;
  category: string;
  weightG: number;
  condition?: string;
  priceCents?: number;
}

export async function addInventoryItem({
  name,
  brand,
  category,
  weightG,
  condition = 'tres_bon',
  priceCents,
}: AddInventoryItemInput) {
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Nom obligatoire' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    const { data: item, error: insertErr } = await supabase
      .from('product_ownership')
      .insert({
        user_id: user.id,
        name: name.trim(),
        brand: brand?.trim() || null,
        category: category || 'Autre',
        weight_g: Math.max(0, weightG || 0),
        condition,
        price_cents: priceCents ? Math.max(0, priceCents) : null,
        is_lent: false,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    revalidatePath('/materiel');
    revalidatePath('/materiel/inventaire');
    revalidatePath('/materiel/depart');

    return { success: true, itemId: item.id };
  } catch (err: any) {
    console.error('[addInventoryItem]', err);
    return { success: false, error: err?.message || 'Erreur serveur' };
  }
}
