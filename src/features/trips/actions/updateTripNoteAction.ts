'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateTripNote } from '@/lib/queries-trip-notes';
import { tripSegmentPath } from '@/features/trips/registry/tripPaths';

export interface UpdateTripNoteActionResult {
  ok: boolean;
  error?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NOTE_CONTENT_LENGTH = 10000;

/**
 * updateTripNoteAction — édition sur place d'une note de carnet.
 * Authentification requise, propriétaire du voyage uniquement (la note doit
 * lui appartenir ET le voyage doit lui appartenir), puis `updateTripNote`
 * existant (l.103-135 de `queries-trip-notes`) et revalidation des vues.
 */
export async function updateTripNoteAction(
  noteId: string,
  content: string
): Promise<UpdateTripNoteActionResult> {
  if (typeof noteId !== 'string' || !UUID_RE.test(noteId)) {
    return { ok: false, error: 'Identifiant de note invalide' };
  }
  const trimmed = typeof content === 'string' ? content.trim() : '';
  if (trimmed === '') {
    return { ok: false, error: 'Le contenu de la note est requis' };
  }
  if (trimmed.length > MAX_NOTE_CONTENT_LENGTH) {
    return { ok: false, error: 'Note trop longue (10 000 caractères maximum)' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'Non authentifié' };
    }

    const { data: note, error: noteError } = await supabase
      .from('trip_notes')
      .select('id, trip_id, author_id')
      .eq('id', noteId)
      .maybeSingle();
    if (noteError) return { ok: false, error: noteError.message };
    if (!note) return { ok: false, error: 'Note introuvable' };

    const noteRow = note as { id: string; trip_id: string; author_id: string };
    if (noteRow.author_id !== user.id) {
      return { ok: false, error: 'Permission refusée' };
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('user_id, slug')
      .eq('id', noteRow.trip_id)
      .maybeSingle();
    if (tripError) return { ok: false, error: tripError.message };
    if (!trip) return { ok: false, error: 'Voyage introuvable' };

    const tripRow = trip as { user_id: string; slug: string | null };
    if (tripRow.user_id !== user.id) {
      return { ok: false, error: 'Permission refusée' };
    }

    const result = await updateTripNote({
      noteId,
      tripId: noteRow.trip_id,
      content: trimmed,
    });
    if (!result.success) {
      return { ok: false, error: result.error || 'Erreur lors de la mise à jour de la note' };
    }

    if (tripRow.slug) {
      revalidatePath(tripSegmentPath(tripRow.slug, ''));
    }
    revalidatePath('/hub/itineraire');
    revalidatePath('/hub/carnet');
    return { ok: true };
  } catch (err) {
    console.error('[updateTripNoteAction]', err);
    return { ok: false, error: 'Erreur serveur' };
  }
}
