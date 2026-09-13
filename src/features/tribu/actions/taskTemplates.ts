'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type PublishTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; error: string };

export type ApplyTemplateResult = { ok: true; count: number } | { ok: false; error: string };

export interface ClubTaskTemplate {
  id: string;
  title: string;
  source: string;
  clubId: string | null;
  items: string[];
}

const PublishSchema = z.object({
  clubId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  items: z.array(z.string().trim().min(1).max(140)).min(1).max(30),
});

/** Publie un modele de checklist pour un club (membre actif requis). */
export async function publishTaskTemplate(input: {
  clubId: string;
  title: string;
  items: string[];
}): Promise<PublishTemplateResult> {
  const parsed = PublishSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Modèle invalide (titre + au moins un élément).' };
  }
  const { clubId, title, items } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const { data: membership } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) {
    return { ok: false, error: 'Réservé aux membres du club.' };
  }

  const { data: template, error: templateError } = await supabase
    .from('group_task_templates')
    .insert({ club_id: clubId, title, source: 'club', created_by: user.id })
    .select('id')
    .single();
  if (templateError || !template) {
    console.error('[tribu/publishTaskTemplate] insert failed:', templateError);
    return { ok: false, error: 'Publication impossible pour le moment.' };
  }

  const { error: itemsError } = await supabase.from('group_task_template_items').insert(
    items.map((itemTitle, index) => ({
      template_id: template.id,
      title: itemTitle,
      position: index,
    }))
  );
  if (itemsError) {
    console.error('[tribu/publishTaskTemplate] items insert failed:', itemsError);
  }

  return { ok: true, templateId: template.id };
}

export type ListTemplatesResult =
  | { ok: true; templates: ClubTaskTemplate[] }
  | { ok: false; error: string };

/** Modeles applicables a un groupe : ceux de son club + les officiels. */
export async function listGroupTaskTemplates(
  clubId: string | null
): Promise<ListTemplatesResult> {
  if (clubId && !z.string().uuid().safeParse(clubId).success) {
    return { ok: false, error: 'Identifiant de club invalide.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  let query = supabase
    .from('group_task_templates')
    .select('id, title, source, club_id')
    .order('created_at', { ascending: false });
  query = clubId ? query.or(`club_id.eq.${clubId},club_id.is.null`) : query.is('club_id', null);

  const { data: templates, error } = await query;
  if (error) {
    return { ok: false, error: 'Chargement impossible.' };
  }

  const rows = (templates ?? []) as Array<{
    id: string;
    title: string;
    source: string;
    club_id: string | null;
  }>;
  if (rows.length === 0) {
    return { ok: true, templates: [] };
  }

  const { data: items } = await supabase
    .from('group_task_template_items')
    .select('template_id, title, position')
    .in('template_id', rows.map((row) => row.id))
    .order('position', { ascending: true });

  const itemsByTemplate = new Map<string, string[]>();
  for (const item of (items ?? []) as Array<{ template_id: string; title: string }>) {
    const list = itemsByTemplate.get(item.template_id) ?? [];
    list.push(item.title);
    itemsByTemplate.set(item.template_id, list);
  }

  return {
    ok: true,
    templates: rows.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      clubId: row.club_id,
      items: itemsByTemplate.get(row.id) ?? [],
    })),
  };
}

/** Applique un modele : insertion en masse dans `group_tasks`. */
export async function applyTaskTemplate(input: {
  groupId: string;
  templateId: string;
}): Promise<ApplyTemplateResult> {
  const schema = z.object({
    groupId: z.string().uuid(),
    templateId: z.string().uuid(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Identifiants invalides.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Connexion requise.' };
  }

  const { data: items, error: itemsError } = await supabase
    .from('group_task_template_items')
    .select('title, position')
    .eq('template_id', parsed.data.templateId)
    .order('position', { ascending: true });
  if (itemsError || !items || items.length === 0) {
    return { ok: false, error: 'Modèle introuvable ou vide.' };
  }

  const { error: insertError } = await supabase.from('group_tasks').insert(
    (items as Array<{ title: string }>).map((item) => ({
      group_id: parsed.data.groupId,
      created_by: user.id,
      title: item.title,
      status: 'todo',
    }))
  );
  if (insertError) {
    console.error('[tribu/applyTaskTemplate] insert failed:', insertError);
    return { ok: false, error: 'Application impossible pour le moment.' };
  }

  return { ok: true, count: items.length };
}
