import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { TripCollaborator, TripCollaboratorRole } from '@/features/trips/types/trip.types';

/**
 * 7.1.1 Récupérer les collaborateurs d'un voyage avec profil
 */
export async function getTripCollaborators(tripId: string): Promise<TripCollaborator[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trip_collaborators')
    .select(`
      id,
      trip_id,
      user_id,
      role,
      joined_at,
      invited_by,
      created_at,
      updated_at
    `)
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('[LKDV Collab] Erreur getTripCollaborators:', error);
    return [];
  }

  // Tenter de joindre les noms de profil si disponibles
  const userIds = (data || []).map(r => r.user_id);
  const profileMap = new Map<string, { full_name?: string | null; avatar_url?: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, username')
      .in('id', userIds);

    (profiles || []).forEach((p: any) => {
      profileMap.set(p.id, {
        full_name: p.full_name || p.username,
        avatar_url: p.avatar_url,
      });
    });
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    trip_id: row.trip_id,
    user_id: row.user_id,
    role: row.role as TripCollaboratorRole,
    joined_at: row.joined_at,
    invited_by: row.invited_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profile: profileMap.get(row.user_id),
  }));
}

/**
 * 7.1.2 Inviter un collaborateur sur un voyage
 */
export async function inviteCollaborator(
  tripId: string,
  identifier: string,
  role: 'editor' | 'viewer',
  invitedByUserId: string
): Promise<{ success: boolean; collaborator?: TripCollaborator; error?: string }> {
  const supabase = await createClient();

  // 1. Rechercher l'utilisateur cible par email, username ou ID
  let targetUserId = identifier.trim();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);

  if (!isUuid) {
    // Chercher dans profiles par username ou email
    const { data: foundProfile } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .or(`username.eq.${targetUserId},email.eq.${targetUserId}`)
      .maybeSingle();

    if (foundProfile) {
      targetUserId = foundProfile.id;
    } else {
      return {
        success: false,
        error: `Aucun utilisateur trouvé avec l'identifiant "${identifier}"`,
      };
    }
  }

  // 2. Vérifier s'il est déjà collaborateur
  const { data: existing } = await supabase
    .from('trip_collaborators')
    .select('id, role')
    .eq('trip_id', tripId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: 'Cet utilisateur est déjà membre de l\'expédition',
    };
  }

  // 3. Insérer le collaborateur
  const { data, error } = await supabase
    .from('trip_collaborators')
    .insert({
      trip_id: tripId,
      user_id: targetUserId,
      role,
      invited_by: invitedByUserId,
    })
    .select()
    .single();

  if (error) {
    console.error('[LKDV Collab] Erreur insert collaborator:', error);
    return {
      success: false,
      error: 'Impossible d\'ajouter ce collaborateur (droits insuffisants ou erreur)',
    };
  }

  return {
    success: true,
    collaborator: {
      id: data.id,
      trip_id: data.trip_id,
      user_id: data.user_id,
      role: data.role as TripCollaboratorRole,
      joined_at: data.joined_at,
      invited_by: data.invited_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  };
}

/**
 * 7.1.3 Modifier le rôle d'un collaborateur
 */
export async function updateCollaboratorRole(
  tripId: string,
  collaboratorId: string,
  newRole: TripCollaboratorRole
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trip_collaborators')
    .update({ role: newRole })
    .eq('id', collaboratorId)
    .eq('trip_id', tripId);

  if (error) {
    console.error('[LKDV Collab] Erreur updateCollaboratorRole:', error);
    return false;
  }

  return true;
}

/**
 * 7.1.4 Retirer un collaborateur du voyage
 */
export async function removeCollaborator(
  tripId: string,
  collaboratorId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trip_collaborators')
    .delete()
    .eq('id', collaboratorId)
    .eq('trip_id', tripId);

  if (error) {
    console.error('[LKDV Collab] Erreur removeCollaborator:', error);
    return false;
  }

  return true;
}
