'use server';

import { tripSegmentPath } from '@/features/trips/registry/tripPaths';
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour modifier la visibilité.' };
    }

    // L1: Seul le propriétaire peut modifier la visibilité d'un voyage
    const { data: trip } = await supabase
      .from('trips')
      .select('user_id')
      .eq('id', parsed.data.tripId)
      .maybeSingle();

    if (!trip || trip.user_id !== user.id) {
      return { success: false, error: 'Seul le propriétaire peut modifier la visibilité de ce voyage.' };
    }

    const { error } = await supabase
      .from('trips')
      .update({ visibility: parsed.data.visibility })
      .eq('id', parsed.data.tripId);

    if (error) {
      console.error('[LKDV Share] Erreur updateTripVisibilityAction:', error);
      return { success: false, error: 'Impossible de modifier la visibilité' };
    }

    if (tripSlug) {
      revalidatePath(tripSegmentPath(tripSlug, ''));
    }

    return { success: true };
  } catch (err: any) {
    console.error('[LKDV Share] Erreur inattendue:', err);
    return { success: false, error: 'Erreur inattendue' };
  }
}
