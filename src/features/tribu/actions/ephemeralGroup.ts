'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface SocialSuggestion {
  id: string;
  name: string;
  hint: 'Groupe commun' | 'Abonnement' | 'Recherche';
  avatarUrl?: string | null;
}

export type SocialSuggestionsResult =
  | { ok: true; suggestions: SocialSuggestion[] }
  | { ok: false; error: string };

export type CreateEphemeralGroupResult =
  | { ok: true; groupId: string; name: string }
  | { ok: false; error: string };

const EPHEMERAL_TTL_DAYS = 7;

/**
 * Suggestions sociales pour le groupe eclair (Phase 2 TRIBU) :
 * co-membres de mes groupes actifs ∪ personnes que je suis, dedupliquees.
 * Aucun nouveau systeme social — uniquement l'existant.
 */
export async function getSocialSuggestions(): Promise<SocialSuggestionsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const { data: myMemberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('status', 'active');
  const groupIds = (myMemberships ?? []).map((m: { group_id: string }) => m.group_id);

  const origins = new Map<string, SocialSuggestion['hint']>();

  if (groupIds.length > 0) {
    const { data: coMembers } = await supabase
      .from('group_members')
      .select('user_id')
      .in('group_id', groupIds)
      .eq('status', 'active');
    for (const row of (coMembers ?? []) as Array<{ user_id: string }>) {
      if (row.user_id !== user.id && !origins.has(row.user_id)) {
        origins.set(row.user_id, 'Groupe commun');
      }
    }
  }

  const { data: following } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id);
  for (const row of (following ?? []) as Array<{ following_id: string }>) {
    if (row.following_id !== user.id && !origins.has(row.following_id)) {
      origins.set(row.following_id, 'Abonnement');
    }
  }

  const ids = Array.from(origins.keys()).slice(0, 30);
  if (ids.length === 0) {
    return { ok: true, suggestions: [] };
  }

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids);

  const suggestions: SocialSuggestion[] = ((profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }>).map((profile) => ({
    id: profile.id,
    name: profile.full_name || 'Voyageur',
    hint: origins.get(profile.id) ?? 'Groupe commun',
    avatarUrl: profile.avatar_url,
  }));

  return { ok: true, suggestions };
}

export async function searchTripPartners(query: string): Promise<SocialSuggestionsResult> {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) {
    return { ok: true, suggestions: [] };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, full_name, avatar_url')
    .ilike('full_name', `%${trimmed}%`)
    .limit(10);

  const suggestions: SocialSuggestion[] = ((profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }>)
    .filter((profile) => profile.id !== user.id)
    .map((profile) => ({
      id: profile.id,
      name: profile.full_name || 'Voyageur',
      hint: 'Recherche',
      avatarUrl: profile.avatar_url,
    }));

  return { ok: true, suggestions };
}

const CreateEphemeralGroupSchema = z.object({
  title: z.string().trim().max(80).optional(),
  inviteeIds: z.array(z.string().uuid()).max(30).default([]),
});

/**
 * Cree une sortie ephemere (TRIBU-R5 : travel_groups + is_ephemeral).
 * `auto_dissolve_at` = maintenant + 7 jours, nettoye par le cron
 * `cleanup-ephemeral-groups` (TRIBU-R6).
 */
export async function createEphemeralGroup(input: {
  title?: string;
  inviteeIds?: string[];
}): Promise<CreateEphemeralGroupResult> {
  const parsed = CreateEphemeralGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Données invalides.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise pour créer une sortie.' };
  }

  const name = parsed.data.title?.trim() || 'Sortie du jour';
  const autoDissolveAt = new Date(Date.now() + EPHEMERAL_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { data: group, error: groupError } = await supabase
    .from('travel_groups')
    .insert({
      name,
      owner_id: user.id,
      visibility: 'private',
      is_ephemeral: true,
      auto_dissolve_at: autoDissolveAt.toISOString(),
    })
    .select('id, name')
    .single();

  if (groupError || !group) {
    console.error('[tribu/createEphemeralGroup] group insert failed:', groupError);
    return { ok: false, error: 'Création de la sortie impossible pour le moment.' };
  }

  const invitees = [...new Set(parsed.data.inviteeIds)].filter((id) => id !== user.id);
  if (invitees.length > 0) {
    const { error: inviteError } = await supabase.from('group_members').insert(
      invitees.map((userId) => ({
        group_id: group.id,
        user_id: userId,
        role: 'member',
        status: 'pending',
      }))
    );
    if (inviteError) {
      console.error('[tribu/createEphemeralGroup] invites insert failed:', inviteError);
      // Compensation : une sortie ephemere sans ses invites n'a pas de sens.
      await supabase.from('travel_groups').delete().eq('id', group.id);
      return { ok: false, error: 'Invitations impossibles — sortie non créée.' };
    }
  }

  return { ok: true, groupId: group.id, name: group.name };
}

export type ConvertEphemeralGroupResult = { ok: true } | { ok: false; error: string };

/**
 * Convertit une sortie eclair en groupe complet : `is_ephemeral=false` et
 * `auto_dissolve_at=NULL` (le cron ne la dissoudra plus). Reserve aux
 * organisateurs/co-organisateurs (capacite `manage_info` cote RLS).
 */
export async function convertEphemeralGroup(groupId: string): Promise<ConvertEphemeralGroupResult> {
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

  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = (membership as { role?: string } | null)?.role;
  const status = (membership as { status?: string } | null)?.status;
  if (status !== 'active' || (role !== 'organizer' && role !== 'co_organizer')) {
    return { ok: false, error: 'Seul un organisateur peut convertir la sortie.' };
  }

  const { error } = await supabase
    .from('travel_groups')
    .update({ is_ephemeral: false, auto_dissolve_at: null })
    .eq('id', groupId);
  if (error) {
    console.error('[tribu/convertEphemeralGroup] update failed:', error);
    return { ok: false, error: 'Conversion impossible pour le moment.' };
  }

  return { ok: true };
}
