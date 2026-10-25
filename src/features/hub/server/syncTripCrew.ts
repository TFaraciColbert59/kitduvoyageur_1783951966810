import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * H-ACT §4 — Synchronisation voyage → équipage (couche groupe universelle).
 *
 * L'équipage auto-créé d'une activité reflète ses participants : dès qu'une
 * deuxième personne rejoint le voyage (collaborateurs), elle devient membre
 * du crew (rôle mappé) et le fonctionnement collectif s'active. Best-effort :
 * un échec de sync ne bloque jamais le flux collaborateurs.
 */

const COLLAB_TO_CREW_ROLE: Record<string, string> = {
  owner: 'owner',
  editor: 'organizer',
  viewer: 'member',
};

/** Ajoute/actualise les membres crew correspondant aux collaborateurs du voyage. */
export async function syncTripCollaboratorsToCrew(
  tripId: string,
  options?: { removeUserId?: string }
): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: trip } = await supabase
      .from('trips')
      .select('crew_id')
      .eq('id', tripId)
      .maybeSingle();
    const crewId = (trip as { crew_id?: string | null } | null)?.crew_id;
    if (!crewId) return;

    const { data: collabs } = await supabase
      .from('trip_collaborators')
      .select('user_id, role')
      .eq('trip_id', tripId);

    if (collabs?.length) {
      const rows = collabs.map((c: { user_id: string; role: string }) => ({
        crew_id: crewId,
        user_id: c.user_id,
        role: COLLAB_TO_CREW_ROLE[c.role] ?? 'member',
        status: 'active' as const,
      }));
      await supabase.from('crew_members').upsert(rows, { onConflict: 'crew_id,user_id' });
    }

    if (options?.removeUserId) {
      // Jamais le propriétaire du crew (protégé par la contrainte métier).
      const { data: crew } = await supabase
        .from('crews')
        .select('created_by')
        .eq('id', crewId)
        .maybeSingle();
      if (crew?.created_by !== options.removeUserId) {
        await supabase
          .from('crew_members')
          .delete()
          .eq('crew_id', crewId)
          .eq('user_id', options.removeUserId);
      }
    }
  } catch (err) {
    console.error('[LKDV CrewSync] syncTripCollaboratorsToCrew (non bloquant):', err);
  }
}
