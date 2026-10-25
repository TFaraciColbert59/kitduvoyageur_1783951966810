'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateTripSchema } from '../schemas/trip.schema';

export interface RenameTripResult {
  ok: boolean;
  error?: string;
}

/**
 * renameTrip — renomme l'activité (trips.title) d'un voyage.
 * Validation partagée avec updateTripSchema (titre trim 3–120), auth via
 * server client, mutation scopée id + user_id (RLS en défense en profondeur),
 * puis revalidation du hub et de l'itinéraire.
 */
export async function renameTrip(
  tripId: string,
  title: string
): Promise<RenameTripResult> {
  if (!tripId || typeof tripId !== 'string' || tripId.length > 128) {
    return { ok: false, error: 'ID voyage invalide' };
  }

  const parsed = updateTripSchema.safeParse({ title });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Titre invalide' };
  }

  const cleanTitle = parsed.data.title;
  if (!cleanTitle) {
    return { ok: false, error: 'Titre invalide' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'Session requise' };
    }

    const { error } = await supabase
      .from('trips')
      .update({
        title: cleanTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .eq('user_id', user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath('/hub');
    revalidatePath('/hub/itineraire');
    return { ok: true };
  } catch (err) {
    console.error('[renameTrip]', err);
    return { ok: false, error: 'Erreur serveur' };
  }
}
