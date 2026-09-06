'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  addTripDocumentSchema,
  deleteTripDocumentSchema,
} from '@/features/trips/schemas/trip.schema';
import { addTripDocument, deleteTripDocument } from '@/lib/queries-trip-docs';

export async function addTripDocumentAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      title: formData.get('title'),
      category: formData.get('category') || 'other',
      fileUrl: formData.get('fileUrl'),
      fileName: formData.get('fileName') || null,
      expiresAt: formData.get('expiresAt') || null,
      notes: formData.get('notes') || null,
    };

    const parsed = addTripDocumentSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Données de document invalides',
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour ajouter un document' };
    }

    const created = await addTripDocument({
      trip_id: parsed.data.tripId,
      user_id: user.id,
      title: parsed.data.title,
      category: parsed.data.category,
      file_url: parsed.data.fileUrl,
      file_name: parsed.data.fileName,
      expires_at: parsed.data.expiresAt,
      notes: parsed.data.notes,
    });

    if (!created) {
      return { success: false, error: 'Impossible d\'enregistrer le document' };
    }

    const tripSlug = formData.get('tripSlug')?.toString();
    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true, message: 'Document sécurisé enregistré avec succès' };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur addTripDocumentAction:', err);
    return { success: false, error: 'Une erreur inattendue est survenue' };
  }
}

export async function deleteTripDocumentAction(
  tripId: string,
  documentId: string,
  tripSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = deleteTripDocumentSchema.safeParse({ tripId, documentId });
    if (!parsed.success) {
      return { success: false, error: 'Identifiants invalides' };
    }

    const ok = await deleteTripDocument(tripId, documentId);
    if (!ok) {
      return { success: false, error: 'Impossible de supprimer ce document' };
    }

    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur deleteTripDocumentAction:', err);
    return { success: false, error: 'Erreur inattendue' };
  }
}
