'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface SetTripKitResult {
  ok: boolean;
  error?: string;
}

/**
 * setTripKit — persiste le kit matériel sélectionné pour une sortie
 * (trips.kit_id, FK materiel_kits ON DELETE SET NULL).
 * Auth via server client, mutation scopée user_id (RLS en défense en
 * profondeur), kit vérifié comme appartenant à l'utilisateur.
 */
export async function setTripKit(
  tripId: string,
  kitId: string | null
): Promise<SetTripKitResult> {
  if (!tripId || typeof tripId !== 'string' || tripId.length > 128) {
    return { ok: false, error: 'ID voyage invalide' };
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (kitId !== null && (!kitId || typeof kitId !== 'string' || !UUID_RE.test(kitId))) {
    return { ok: false, error: 'ID kit invalide' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'Non authentifié' };
    }

    if (kitId) {
      const { data: kit, error: kitError } = await supabase
        .from('materiel_kits')
        .select('id')
        .eq('id', kitId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (kitError) return { ok: false, error: kitError.message };
      if (!kit) return { ok: false, error: 'Kit introuvable' };
    }

    const { error } = await supabase
      .from('trips')
      .update({
        kit_id: kitId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .eq('user_id', user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath('/hub/kit-voyage');
    revalidatePath('/hub', 'page');
    return { ok: true };
  } catch (err) {
    console.error('[setTripKit]', err);
    return { ok: false, error: 'Erreur serveur' };
  }
}
