import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { convertTripToCarnetData } from '@/features/trips/engine/carnetConversionEngine';
import type { TripStatus } from '@/features/trips/types/trip.types';

/**
 * 8.5 Mettre à jour le statut du voyage (ex: passage à 'completed')
 */
export async function updateTripStatus(
  tripId: string,
  status: TripStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trips')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);

  if (error) {
    console.error('[LKDV TripCompletion] Erreur updateTripStatus:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 8.6 Publier un voyage vécu en carnet de bord communautaire
 */
export async function publishTripToCarnet(
  tripId: string,
  options?: {
    title?: string;
    description?: string;
    isPublic?: boolean;
    authorName?: string;
  }
): Promise<{ success: boolean; carnetId?: string; error?: string }> {
  const supabase = await createClient();

  // 1. Récupérer le voyage complet avec toutes ses relations
  const trip = await getTripById(tripId);
  if (!trip) {
    return { success: false, error: 'Voyage introuvable' };
  }

  // 2. Transformer le voyage via le moteur pur
  const { carnet, moments, kitItems } = convertTripToCarnetData(trip, {
    customTitle: options?.title,
    description: options?.description,
    isPublic: options?.isPublic !== false,
    authorName: options?.authorName,
  });

  // 3. Insérer la ligne principale dans `carnets`
  const { data: carnetRow, error: carnetError } = await supabase
    .from('carnets')
    .insert(carnet)
    .select('id')
    .single();

  if (carnetError || !carnetRow) {
    console.error('[LKDV TripCompletion] Erreur insertion carnet:', carnetError);
    return { success: false, error: carnetError?.message || 'Erreur création carnet' };
  }

  const carnetId = carnetRow.id;

  // 4. Insérer les moments de voyage en parallèle
  if (moments.length > 0) {
    const momentsPayload = moments.map(m => ({
      ...m,
      carnet_id: carnetId,
    }));
    const { error: momentsError } = await supabase
      .from('carnet_moments')
      .insert(momentsPayload);

    if (momentsError) {
      console.warn('[LKDV TripCompletion] Avertissement insertion carnet_moments:', momentsError);
    }
  }

  // 5. Insérer les items de kit emportés
  if (kitItems.length > 0) {
    const kitPayload = kitItems.map(k => ({
      ...k,
      carnet_id: carnetId,
    }));
    const { error: kitError } = await supabase
      .from('carnet_kit_items')
      .insert(kitPayload);

    if (kitError) {
      console.warn('[LKDV TripCompletion] Avertissement insertion carnet_kit_items:', kitError);
    }
  }

  // 6. Marquer le voyage comme complété si ce n'était pas déjà fait
  if (trip.status !== 'completed') {
    await updateTripStatus(tripId, 'completed');
  }

  return { success: true, carnetId };
}

/**
 * 8.7 Soumettre des avis certifiés terrain (has_field_proof) pour les lieux visités
 */
export async function submitTripFieldReviews(
  tripId: string,
  authorId: string,
  reviews: Array<{ placeId: string; rating: number; comment: string }>
): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = await createClient();

  if (reviews.length === 0) {
    return { success: true, count: 0 };
  }

  const payload = reviews.map(r => ({
    place_id: r.placeId,
    author_id: authorId,
    rating: r.rating,
    comment: r.comment,
    has_field_proof: true,
    trip_id: tripId,
    visit_date: new Date().toISOString().slice(0, 10),
  }));

  const { error } = await supabase
    .from('place_reviews')
    .insert(payload);

  if (error) {
    console.error('[LKDV TripCompletion] Erreur submitTripFieldReviews:', error);
    return { success: false, count: 0, error: error.message };
  }

  return { success: true, count: reviews.length };
}
