'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const CreateGroupFromClubSchema = z.object({
  clubId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  memberIds: z.array(z.string().uuid()).max(50).default([]),
});

export type CreateGroupFromClubResult =
  | { ok: true; groupId: string; name: string; warning?: string }
  | { ok: false; error: string };

/**
 * Crée un groupe de voyage rattaché à un club (Phase 1 TRIBU).
 * - le créateur doit être membre actif du club ;
 * - le groupe est `club_only` avec `parent_club_id` ;
 * - le membership organizer du créateur est posé par le trigger DB
 *   `seed_group_owner_membership` (aucun insert manuel) ;
 * - les membres du club sélectionnés reçoivent une invitation `pending`.
 */
export async function createGroupFromClub(input: {
  clubId: string;
  name: string;
  memberIds?: string[];
}): Promise<CreateGroupFromClubResult> {
  const parsed = CreateGroupFromClubSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Données invalides.' };
  }
  const { clubId, name, memberIds } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise pour créer un groupe.' };
  }

  const { data: club } = await supabase
    .from('clubs')
    .select('id, name')
    .eq('id', clubId)
    .maybeSingle();
  if (!club) {
    return { ok: false, error: 'Club introuvable.' };
  }

  const { data: membership } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) {
    return { ok: false, error: 'Vous devez être membre du club pour créer un groupe.' };
  }

  const { data: group, error: groupError } = await supabase
    .from('travel_groups')
    .insert({
      name,
      owner_id: user.id,
      visibility: 'club_only',
      parent_club_id: clubId,
      theme: 'Collectif',
    })
    .select('id, name')
    .single();

  if (groupError || !group) {
    console.error('[tribu/createGroupFromClub] group insert failed:', groupError);
    return { ok: false, error: 'Création du groupe impossible pour le moment.' };
  }

  const invitees = [...new Set(memberIds)].filter((id) => id !== user.id);
  let warning: string | undefined;
  if (invitees.length > 0) {
    const { data: activeMembers } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('status', 'active')
      .in('user_id', invitees);

    const validInvitees = (activeMembers ?? [])
      .map((m: { user_id: string }) => m.user_id)
      .filter((id: string) => id !== user.id);

    if (validInvitees.length > 0) {
      const { error: inviteError } = await supabase.from('group_members').insert(
        validInvitees.map((userId: string) => ({
          group_id: group.id,
          user_id: userId,
          role: 'member',
          status: 'pending',
        }))
      );
      if (inviteError) {
        console.error('[tribu/createGroupFromClub] invites insert failed:', inviteError);
        warning =
          'Groupe créé, mais les invitations ont échoué — invitez les membres depuis le Hub.';
      }
    }
  }

  revalidatePath('/clubs', 'layout');
  return { ok: true, groupId: group.id, name: group.name, warning };
}
