'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  inviteCollaboratorSchema,
  updateCollaboratorRoleSchema,
  removeCollaboratorSchema,
} from '@/features/trips/schemas/trip.schema';
import {
  inviteCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
} from '@/lib/queries-trip-collab';

export async function inviteCollaboratorAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const rawData = {
      tripId: formData.get('tripId'),
      identifier: formData.get('identifier'),
      role: formData.get('role') || 'viewer',
    };

    const parsed = inviteCollaboratorSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Données d\'invitation invalides',
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour inviter un collaborateur' };
    }

    const result = await inviteCollaborator(
      parsed.data.tripId,
      parsed.data.identifier,
      parsed.data.role,
      user.id
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Erreur lors de l\'invitation' };
    }

    const tripSlug = formData.get('tripSlug')?.toString();
    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true, message: 'Collaborateur invité avec succès' };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur inviteCollaboratorAction:', err);
    return { success: false, error: 'Une erreur inattendue est survenue' };
  }
}

export async function updateRoleAction(
  tripId: string,
  collaboratorId: string,
  role: 'owner' | 'editor' | 'viewer',
  tripSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = updateCollaboratorRoleSchema.safeParse({ tripId, collaboratorId, role });
    if (!parsed.success) {
      return { success: false, error: 'Rôle invalide' };
    }

    const ok = await updateCollaboratorRole(tripId, collaboratorId, role);
    if (!ok) {
      return { success: false, error: 'Impossible de modifier le rôle' };
    }

    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur updateRoleAction:', err);
    return { success: false, error: 'Erreur inattendue' };
  }
}

export async function removeCollaboratorAction(
  tripId: string,
  collaboratorId: string,
  tripSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = removeCollaboratorSchema.safeParse({ tripId, collaboratorId });
    if (!parsed.success) {
      return { success: false, error: 'Identifiants invalides' };
    }

    const ok = await removeCollaborator(tripId, collaboratorId);
    if (!ok) {
      return { success: false, error: 'Impossible de retirer ce membre' };
    }

    if (tripSlug) {
      revalidatePath(`/voyages/${tripSlug}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[LKDV Action] Erreur removeCollaboratorAction:', err);
    return { success: false, error: 'Erreur inattendue' };
  }
}
