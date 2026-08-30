'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { DepartStatus } from '@/features/materiel/services/getDepartDetail';

export async function updateDepartStatus(kitId: string, status: DepartStatus) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    if (!kitId || kitId.length > 100) {
      return { success: false, error: 'Identifiant invalide' };
    }

    const { error } = await supabase
      .from('materiel_kits')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', kitId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[updateDepartStatus] error', error);
      return { success: false, error: 'Erreur lors de la mise à jour du statut' };
    }

    revalidatePath('/materiel/depart');
    revalidatePath(`/materiel/depart/${kitId}`);
    return { success: true, status };
  } catch (err: any) {
    console.error('[updateDepartStatus] unexpected error', err);
    return { success: false, error: err?.message || 'Erreur inconnue' };
  }
}
