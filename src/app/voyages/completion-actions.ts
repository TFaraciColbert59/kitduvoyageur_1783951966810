'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  addTripNoteSchema,
  deleteTripNoteSchema,
  updateTripStatusSchema,
  publishTripCarnetSchema,
  submitTripFieldReviewsSchema,
} from '@/features/trips/schemas/trip.schema';
import {
  addTripNote,
  deleteTripNote,
} from '@/lib/queries-trip-notes';
import {
  updateTripStatus,
  publishTripToCarnet,
  submitTripFieldReviews,
} from '@/lib/queries-trip-completion';

/**
 * Action : Ajouter une note / récit au carnet de bord du voyage
 */
export async function addTripNoteAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      title: formData.get('title') || null,
      content: formData.get('content'),
      dayNumber: formData.get('dayNumber') ? Number(formData.get('dayNumber')) : null,
      isPinned: formData.get('isPinned') === 'true',
    };

    const parsed = addTripNoteSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Données de note invalides',
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour écrire dans le carnet' };
    }

    const result = await addTripNote({
      tripId: parsed.data.tripId,
      authorId: user.id,
      title: parsed.data.title,
      content: parsed.data.content,
      dayNumber: parsed.data.dayNumber,
      isPinned: parsed.data.isPinned,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Erreur lors de l\'enregistrement de la note' };
    }

    const tripSlug = formData.get('tripSlug')?.toString();
    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true, message: 'Note ajoutée au carnet de bord' };
  } catch (err: any) {
    console.error('[LKDV Action] addTripNoteAction error:', err);
    return { success: false, error: err.message || 'Erreur interne' };
  }
}

/**
 * Action : Supprimer une note du carnet de bord
 */
export async function deleteTripNoteAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      noteId: formData.get('noteId'),
    };

    const parsed = deleteTripNoteSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Identifiants invalides',
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour supprimer une note' };
    }

    const result = await deleteTripNote(parsed.data.noteId, parsed.data.tripId);
    if (!result.success) {
      return { success: false, error: result.error || 'Erreur lors de la suppression de la note' };
    }

    const tripSlug = formData.get('tripSlug')?.toString();
    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true, message: 'Note supprimée' };
  } catch (err: any) {
    console.error('[LKDV Action] deleteTripNoteAction error:', err);
    return { success: false, error: err.message || 'Erreur interne' };
  }
}

/**
 * Action : Mettre à jour le statut du voyage (draft -> planned -> active -> completed)
 */
export async function updateTripStatusAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      status: formData.get('status'),
    };

    const parsed = updateTripStatusSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Statut de voyage invalide',
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour modifier le statut du voyage' };
    }

    const result = await updateTripStatus(parsed.data.tripId, parsed.data.status);
    if (!result.success) {
      return { success: false, error: result.error || 'Erreur lors du changement de statut' };
    }

    const tripSlug = formData.get('tripSlug')?.toString();
    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
      revalidatePath('/voyages');
    }

    return {
      success: true,
      message: parsed.data.status === 'completed'
        ? 'Voyage clôturé avec succès ! Félicitations pour cette expédition.'
        : 'Statut du voyage mis à jour',
    };
  } catch (err: any) {
    console.error('[LKDV Action] updateTripStatusAction error:', err);
    return { success: false, error: err.message || 'Erreur interne' };
  }
}

/**
 * Action : Publier le carnet communautaire à partir du voyage vécu
 */
export async function publishTripCarnetAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; carnetId?: string; message?: string; error?: string }> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      title: formData.get('title') || undefined,
      description: formData.get('description') || undefined,
      isPublic: formData.get('isPublic') !== 'false',
    };

    const parsed = publishTripCarnetSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Données de publication invalides',
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour publier un carnet' };
    }

    const result = await publishTripToCarnet(parsed.data.tripId, {
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      isPublic: parsed.data.isPublic,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Erreur lors de la publication du carnet' };
    }

    const tripSlug = formData.get('tripSlug')?.toString();
    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
      revalidatePath('/carnets');
    }

    return {
      success: true,
      carnetId: result.carnetId,
      message: 'Votre carnet de bord a été publié dans la communauté LKDV !',
    };
  } catch (err: any) {
    console.error('[LKDV Action] publishTripCarnetAction error:', err);
    return { success: false, error: err.message || 'Erreur interne' };
  }
}

/**
 * Action : Soumettre des avis certifiés terrain (has_field_proof = true)
 */
export async function submitTripFieldReviewsAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; count?: number; message?: string; error?: string }> {
  try {
    const tripId = formData.get('tripId')?.toString();
    const reviewsJson = formData.get('reviews')?.toString();

    if (!tripId || !reviewsJson) {
      return { success: false, error: 'Données d\'avis incomplètes' };
    }

    const rawReviews = JSON.parse(reviewsJson);
    const parsed = submitTripFieldReviewsSchema.safeParse({
      tripId,
      reviews: rawReviews,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Avis invalides',
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour certifier un lieu' };
    }

    const result = await submitTripFieldReviews(parsed.data.tripId, user.id, parsed.data.reviews);
    if (!result.success) {
      return { success: false, error: result.error || 'Erreur lors de l\'enregistrement des avis' };
    }

    const tripSlug = formData.get('tripSlug')?.toString();
    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
      revalidatePath('/lieux');
    }

    return {
      success: true,
      count: result.count,
      message: `${result.count} avis certifié(s) terrain avec succès ! Merci pour la communauté.`,
    };
  } catch (err: any) {
    console.error('[LKDV Action] submitTripFieldReviewsAction error:', err);
    return { success: false, error: err.message || 'Erreur interne' };
  }
}
