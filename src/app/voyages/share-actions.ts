'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateTripVisibilitySchema } from '@/features/trips/schemas/trip.schema';
import type { TripVisibility } from '@/features/trips/types/trip.types';

export async function updateTripVisibilityAction(
  tripId: string,
  visibility: TripVisibility,
  tripSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = updateTripVisibilitySchema.safeParse({ tripId, visibility });
    if (!parsed.success) {
      return { success: false, error: 'Visibilité invalide' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('trips')
      .update({ visibility: parsed.data.visibility })
      .eq('id', parsed.data.tripId);

    if (error) {
      console.error('[LKDV Share] Erreur updateTripVisibilityAction:', error);
      return { success: false, error: 'Impossible de modifier la visibilité' };
    }

    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[LKDV Share] Erreur inattendue:', err);
    return { success: false, error: 'Erreur inattendue' };
  }
}
