'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createCrewSchema,
  updateCrewSchema,
  joinCrewCodeSchema,
  inviteCrewMemberSchema,
} from '../schemas/crew.schema';
import {
  verifyInviteToken,
  validateJoinAttempt,
} from '../lib/invitations';
import { emitEvent } from '@/lib/events/eventBus';

export interface ActionResponse<T = unknown> {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

/**
 * Créer un nouvel équipage (Server Action)
 */
export async function createCrewAction(
  formData: FormData
): Promise<ActionResponse<{ id: string; slug: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Vous devez être connecté pour créer un équipage.' };
  }

  const raw = {
    name: formData.get('name'),
    description: formData.get('description'),
    theme: formData.get('theme') || 'Trek',
    visibility: formData.get('visibility') || 'private',
    max_members: formData.get('max_members') || 12,
  };

  const parsed = createCrewSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Veuillez corriger les erreurs de saisie.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const name = parsed.data.name;
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;
  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  // 1. Insertion de l'équipage
  const { data: crew, error: insertErr } = await supabase
    .from('crews')
    .insert({
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      theme: parsed.data.theme,
      visibility: parsed.data.visibility,
      invite_code: inviteCode,
      max_members: parsed.data.max_members,
      created_by: user.id,
    })
    .select('id, slug')
    .single();

  if (insertErr || !crew) {
    return { success: false, error: insertErr?.message || 'Erreur lors de la création de l’équipage.' };
  }

  // 2. Rattachement du créateur comme owner
  await supabase.from('crew_members').insert({
    crew_id: crew.id,
    user_id: user.id,
    role: 'owner',
    status: 'active',
  });

  // Émission d'événement crew.created
  await emitEvent({
    event_type: 'crew.created',
    actor_id: user.id,
    entity_type: 'crew',
    entity_id: crew.id,
    visibility: (crew as any).visibility === 'public' ? 'public' : 'crew',
    crew_id: crew.id,
    metadata: {
      crewName: (crew as any).name,
      slug: (crew as any).slug,
    },
  });

  revalidatePath('/equipages');
  return { success: true, data: crew };
}

/**
 * Rejoindre un équipage via code d'invitation avec consentement explicite
 */
export async function joinCrewByCodeAction(
  code: string,
  consent: boolean
): Promise<ActionResponse<{ crewId: string; slug: string }>> {
  if (!consent) {
    return { success: false, error: 'Votre consentement explicite est requis pour rejoindre un équipage.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Connexion requise.' };
  }

  const parsed = joinCrewCodeSchema.safeParse({ code, consent });
  if (!parsed.success) {
    return { success: false, error: 'Code d’invitation invalide.' };
  }

  // 1. Trouver l'équipage
  const { data: crew, error: findErr } = await supabase
    .from('crews')
    .select('id, slug, max_members')
    .eq('invite_code', parsed.data.code.toUpperCase())
    .maybeSingle();

  if (findErr || !crew) {
    return { success: false, error: 'Aucun équipage trouvé avec ce code.' };
  }

  // 2. Compter les membres et vérifier si déjà membre
  const { data: existingMembers } = await supabase
    .from('crew_members')
    .select('user_id')
    .eq('crew_id', crew.id)
    .eq('status', 'active');

  const memberList = existingMembers || [];
  const isAlready = memberList.some(m => m.user_id === user.id);

  const validation = validateJoinAttempt({
    crew,
    currentMemberCount: memberList.length,
    isAlreadyMember: isAlready,
    currentUserId: user.id,
  });

  if (!validation.allowed) {
    if (validation.error === 'ALREADY_MEMBER') {
      return { success: false, error: 'Vous faites déjà partie de cet équipage.' };
    }
    if (validation.error === 'CREW_FULL') {
      return { success: false, error: 'Cet équipage a atteint sa limite de membres.' };
    }
    return { success: false, error: 'Action non autorisée.' };
  }

  // 3. Rejoindre
  const { error: joinErr } = await supabase.from('crew_members').insert({
    crew_id: crew.id,
    user_id: user.id,
    role: 'member',
    status: 'active',
  });

  if (joinErr) {
    return { success: false, error: joinErr.message };
  }

  // Émission d'événement crew.joined
  await emitEvent({
    event_type: 'crew.joined',
    actor_id: user.id,
    entity_type: 'crew',
    entity_id: crew.id,
    visibility: 'crew',
    crew_id: crew.id,
    metadata: {
      crewId: crew.id,
      slug: crew.slug,
      userId: user.id,
    },
  });

  revalidatePath('/equipages');
  revalidatePath(`/equipages/${crew.slug}`);
  return { success: true, data: { crewId: crew.id, slug: crew.slug } };
}

/**
 * Quitter un équipage (Self-leave)
 */
export async function leaveCrewAction(crewId: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Connexion requise.' };
  }

  const { error } = await supabase
    .from('crew_members')
    .delete()
    .eq('crew_id', crewId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Émission d'événement crew.left
  await emitEvent({
    event_type: 'crew.left',
    actor_id: user.id,
    entity_type: 'crew',
    entity_id: crewId,
    visibility: 'crew',
    crew_id: crewId,
    metadata: {
      crewId,
      userId: user.id,
    },
  });

  revalidatePath('/equipages');
  return { success: true };
}
