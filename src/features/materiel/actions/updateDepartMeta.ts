'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateDepartMeta({
  kitId,
  name,
  startsAt,
}: {
  kitId: string;
  name?: string;
  startsAt?: string | null;
}) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    if (!kitId || kitId.length > 100) {
      return { success: false, error: 'Identifiant invalide' };
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      const cleanName = name.replace(/\s*\((?:copie|copy)\)\s*/gi, '').trim();
      if (cleanName.length > 0 && cleanName.length <= 150) {
        updates.name = cleanName;
      }
    }

    if (startsAt !== undefined) {
      updates.starts_at = startsAt;
    }

    const { error } = await supabase
      .from('materiel_kits')
      .update(updates)
      .eq('id', kitId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[updateDepartMeta] error', error);
      return { success: false, error: 'Erreur lors de la mise à jour' };
    }

    revalidatePath(`/materiel/depart`);
    revalidatePath(`/materiel/depart/${kitId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[updateDepartMeta] unexpected error', err);
    return { success: false, error: err?.message || 'Erreur inconnue' };
  }
}
