'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createPlaceReviewSchema,
  createPlaceReportSchema,
  type CreatePlaceReviewInput,
  type CreatePlaceReportInput,
} from '@/features/places/schemas/place.schema';
import { getPlaceById } from '@/lib/queries-places';
import { getTripById } from '@/lib/queries-trips';

export interface ActionState<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
}

/**
 * 1. Ajouter ou mettre à jour un avis sur un lieu avec certification de preuve terrain
 */
export async function addPlaceReviewAction(
  input: CreatePlaceReviewInput
): Promise<ActionState<{ reviewId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Vous devez être connecté pour publier un avis.' };
    }

    const parsed = createPlaceReviewSchema.parse(input);

    // Upsert sur la contrainte UNIQUE (place_id, author_id)
    const { data, error } = await supabase
      .from('place_reviews')
      .upsert(
        {
          place_id: parsed.place_id,
          author_id: user.id,
          rating: parsed.rating,
          comment: parsed.comment,
          has_field_proof: parsed.has_field_proof,
          visit_date: parsed.visit_date || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'place_id,author_id' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('[addPlaceReviewAction] Erreur Supabase :', error);
      return { error: error.message };
    }

    revalidatePath('/lieux');
    return { success: true, data: { reviewId: data.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inattendue lors de la publication.';
    return { error: message };
  }
}

/**
 * 2. Signaler un lieu pour surfréquentation, dégradation ou danger (Sécurité physique et éthique)
 */
export async function reportPlaceAction(
  input: CreatePlaceReportInput
): Promise<ActionState<{ reportId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const parsed = createPlaceReportSchema.parse(input);

    const { data, error } = await supabase
      .from('place_reports')
      .insert({
        place_id: parsed.place_id,
        reporter_id: user?.id || null,
        reason: parsed.reason,
        details: parsed.details,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[reportPlaceAction] Erreur Supabase :', error);
      return { error: error.message };
    }

    return { success: true, data: { reportId: data.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors du signalement.';
    return { error: message };
  }
}

/**
 * 3. Ajouter un lieu communautaire à un itinéraire de voyage existant
 * Conforme ROADMAP §1.2 & §4.1 (Entité pivot Voyage & items hétérogènes)
 */
export async function addPlaceToTripAction(params: {
  tripId: string;
  dayNumber: number;
  placeId: string;
}): Promise<ActionState<{ stepId: string; tripSlug: string }>> {
  try {
    const { tripId, dayNumber, placeId } = params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Vous devez être connecté pour modifier votre voyage.' };
    }

    // Récupérer le voyage et vérifier les droits
    const trip = await getTripById(tripId);
    if (!trip) {
      return { error: 'Voyage introuvable.' };
    }

    // Récupérer les détails du lieu
    const place = await getPlaceById(placeId, { isAdmin: true });
    if (!place) {
      return { error: 'Lieu introuvable.' };
    }

    // Trouver le prochain order_index pour cette journée
    const { data: existingSteps } = await supabase
      .from('trip_steps')
      .select('order_index')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrderIndex =
      existingSteps && existingSteps.length > 0 ? existingSteps[0].order_index + 1 : 0;

    // Insertion transactionnelle de l'étape (trip_steps)
    const { data: step, error: stepErr } = await supabase
      .from('trip_steps')
      .insert({
        trip_id: tripId,
        day_number: dayNumber,
        order_index: nextOrderIndex,
        title: place.name,
        location_name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        elevation_gain_m: place.altitude_m || null,
        activity_type: place.category,
        step_type: 'visit',
        ref_type: 'place',
        ref_id: place.id,
      })
      .select('id')
      .single();

    if (stepErr) {
      console.error('[addPlaceToTripAction] Erreur trip_steps :', stepErr);
      return { error: stepErr.message };
    }

    // Ajout dans trip_items pour le kit et l'organisation générale (source: 'user')
    await supabase.from('trip_items').insert({
      trip_id: tripId,
      title: place.name,
      category: 'activity',
      ref_type: 'place',
      ref_id: place.id,
      source: 'user',
      is_mandatory: false,
    });

    revalidatePath(`/voyages/${trip.slug}`);
    revalidatePath(`/voyages/${trip.slug}/itineraire`);

    return {
      success: true,
      data: { stepId: step.id, tripSlug: trip.slug },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de l’ajout au voyage.';
    return { error: message };
  }
}
