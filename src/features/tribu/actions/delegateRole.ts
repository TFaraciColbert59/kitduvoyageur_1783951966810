'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type DelegationResult = { ok: true } | { ok: false; error: string };

export interface ActiveDelegation {
  id: string;
  fromUserId: string;
  toUserId: string;
  delegatedRole: string;
  endsAt: string;
}

const CreateDelegationSchema = z.object({
  groupId: z.string().uuid(),
  toUserId: z.string().uuid(),
  delegatedRole: z.enum(['organizer', 'co_organizer', 'member', 'observer']),
  durationHours: z.number().int().min(1).max(168),
});

/**
 * Delegation temporaire de role (Phase 3 TRIBU). La RLS borne : le
 * delegataire doit etre membre actif, le delegateur doit detenir le role
 * delegue (ou `manage_members`).
 */
export async function createRoleDelegation(input: {
  groupId: string;
  toUserId: string;
  delegatedRole: 'organizer' | 'co_organizer' | 'member' | 'observer';
  durationHours: number;
}): Promise<DelegationResult> {
  const parsed = CreateDelegationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Données de délégation invalides.' };
  }
  const { groupId, toUserId, delegatedRole, durationHours } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }
  if (toUserId === user.id) {
    return { ok: false, error: 'Choisissez un autre membre.' };
  }

  const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('group_role_delegations').insert({
    group_id: groupId,
    from_user_id: user.id,
    to_user_id: toUserId,
    delegated_role: delegatedRole,
    ends_at: endsAt,
  });
  if (error) {
    console.error('[tribu/createRoleDelegation] insert failed:', error);
    return { ok: false, error: 'Délégation impossible pour le moment.' };
  }
  return { ok: true };
}

export async function revokeRoleDelegation(delegationId: string): Promise<DelegationResult> {
  if (!z.string().uuid().safeParse(delegationId).success) {
    return { ok: false, error: 'Identifiant invalide.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const { error } = await supabase
    .from('group_role_delegations')
    .delete()
    .eq('id', delegationId);
  if (error) {
    console.error('[tribu/revokeRoleDelegation] delete failed:', error);
    return { ok: false, error: 'Reprise impossible pour le moment.' };
  }
  return { ok: true };
}

export type ListDelegationsResult =
  | { ok: true; delegations: ActiveDelegation[] }
  | { ok: false; error: string };

export async function listMyDelegations(groupId: string): Promise<ListDelegationsResult> {
  if (!z.string().uuid().safeParse(groupId).success) {
    return { ok: false, error: 'Identifiant invalide.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const { data, error } = await supabase
    .from('group_role_delegations')
    .select('id, from_user_id, to_user_id, delegated_role, ends_at')
    .eq('group_id', groupId)
    .gt('ends_at', new Date().toISOString())
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
  if (error) {
    return { ok: false, error: 'Chargement impossible.' };
  }

  return {
    ok: true,
    delegations: ((data ?? []) as Array<Record<string, string>>).map((row) => ({
      id: row.id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      delegatedRole: row.delegated_role,
      endsAt: row.ends_at,
    })),
  };
}
