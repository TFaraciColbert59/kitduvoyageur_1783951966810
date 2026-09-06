'use server';

import { revalidatePath } from 'next/cache';
import {
  toggleTripItemPacked,
  addTripItem,
  deleteTripItem,
  addRecommendedItemToTrip,
} from '@/lib/queries-trip-kit';
import type { ContextualGearRecommendation } from '@/features/trips/types/kit.types';

export async function togglePackedAction(
  itemId: string,
  isPacked: boolean,
  tripSlug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ok = await toggleTripItemPacked(itemId, isPacked);
    if (!ok) return { success: false, error: 'Impossible de modifier le statut de l’équipement' };

    revalidatePath(`/voyages/${tripSlug}`);
    revalidatePath(`/voyages/${tripSlug}/kit`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur serveur' };
  }
}

export async function addCustomTripItemAction(
  tripId: string,
  tripSlug: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const itemName = String(formData.get('itemName') || '').trim();
    if (!itemName) {
      return { success: false, error: 'Le nom de l’équipement est requis.' };
    }

    const category = String(formData.get('category') || 'misc');
    const weightGrams = Number(formData.get('weightGrams')) || 0;
    const quantity = Math.max(1, Number(formData.get('quantity')) || 1);
    const isVital = formData.get('isVital') === 'true';
    const isWorn = formData.get('isWorn') === 'true';
    const isConsumable = formData.get('isConsumable') === 'true';

    const item = await addTripItem({
      tripId,
      itemName,
      category,
      weightGrams: weightGrams > 0 ? weightGrams : undefined,
      quantity,
      priority: isVital ? 'vital' : 'recommended',
      isVital,
      isWorn,
      isConsumable,
      source: 'user',
    });

    if (!item) {
      return { success: false, error: 'Erreur lors de l’ajout de l’équipement' };
    }

    revalidatePath(`/voyages/${tripSlug}`);
    revalidatePath(`/voyages/${tripSlug}/kit`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur serveur' };
  }
}

export async function deleteTripItemAction(
  itemId: string,
  tripSlug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ok = await deleteTripItem(itemId);
    if (!ok) return { success: false, error: 'Impossible de supprimer l’équipement' };

    revalidatePath(`/voyages/${tripSlug}`);
    revalidatePath(`/voyages/${tripSlug}/kit`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur serveur' };
  }
}

export async function addRecommendedItemAction(
  tripId: string,
  tripSlug: string,
  recommendation: ContextualGearRecommendation
): Promise<{ success: boolean; error?: string }> {
  try {
    const item = await addRecommendedItemToTrip(tripId, recommendation);
    if (!item) return { success: false, error: 'Erreur lors de l’ajout de la recommandation' };

    revalidatePath(`/voyages/${tripSlug}`);
    revalidatePath(`/voyages/${tripSlug}/kit`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur serveur' };
  }
}
