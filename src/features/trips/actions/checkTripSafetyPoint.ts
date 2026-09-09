'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { tripSegmentPath } from '@/features/trips/registry/tripPaths';

export interface CheckTripSafetyPointResult {
  ok: boolean;
  error?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * checkTripSafetyPoint — persiste le pointage d'un checkpoint de sécurité
 * (trip_safety_checkpoints.status='checked', checked_at=now()).
 * Auth via server client ; la mutation est scopée eq('id').eq('trip_id') et le
 * voyage est vérifié comme appartenant à l'utilisateur (owner) ou comme
 * édité par un collaborateur owner/editor (défense en profondeur avec RLS).
 */
export async function checkTripSafetyPoint(
  tripId: string,
  checkpointId: string,
  tripSlug?: string
): Promise<CheckTripSafetyPointResult> {
  if (
    !tripId ||
    !checkpointId ||
    typeof tripId !== 'string' ||
    typeof checkpointId !== 'string' ||
    !UUID_RE.test(tripId) ||
    !UUID_RE.test(checkpointId)
  ) {
    return { ok: false, error: 'Identifiants invalides' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'Non authentifié' };
    }

    // Vérification d'accès : propriétaire du voyage ou collaborateur éditeur.
    const { data: trip } = await supabase
      .from('trips')
      .select('user_id')
      .eq('id', tripId)
      .maybeSingle();
    if (!trip) {
      return { ok: false, error: 'Voyage introuvable' };
    }

    const isOwner = trip.user_id === user.id;
    if (!isOwner) {
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', user.id)
        .in('role', ['owner', 'editor'])
        .maybeSingle();
      if (!collab) {
        return { ok: false, error: 'Permission refusée' };
      }
    }

    // Le checkpoint doit bien appartenir à ce voyage (jamais de pointage croisé).
    const { data: checkpoint } = await supabase
      .from('trip_safety_checkpoints')
      .select('id')
      .eq('id', checkpointId)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (!checkpoint) {
      return { ok: false, error: 'Point de contrôle introuvable' };
    }

    const { error } = await supabase
      .from('trip_safety_checkpoints')
      .update({
        status: 'checked',
        checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkpointId)
      .eq('trip_id', tripId);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (tripSlug) {
      revalidatePath(tripSegmentPath(tripSlug, ''));
    }
    revalidatePath('/hub', 'page');
    revalidatePath('/hub/securite', 'page');
    return { ok: true };
  } catch (err) {
    console.error('[checkTripSafetyPoint]', err);
    return { ok: false, error: 'Erreur serveur' };
  }
}
