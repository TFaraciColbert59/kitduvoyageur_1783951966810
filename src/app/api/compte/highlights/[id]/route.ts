import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();

const Patch = z
  .object({
    title: z.string().trim().min(1).max(60).optional(),
    coverStoryId: z.string().uuid().nullable().optional(),
    addStoryId: z.string().uuid().optional(),
    removeStoryId: z.string().uuid().optional(),
  })
  .strict();

interface StoryRow {
  id: string;
  image_url: string | null;
  storage_path: string | null;
  media_type: string | null;
  caption: string | null;
}

const STORY_COLUMNS = 'id,image_url,storage_path,media_type,caption';

function toStory(row: StoryRow) {
  return {
    id: row.id,
    image: row.image_url || (row.storage_path ? `/api/stories/${row.id}/media` : ''),
    caption: row.caption || '',
    isVideo: row.media_type === 'video',
  };
}

/**
 * Story à la une du propriétaire : lecture (titre, couverture, stories de
 * l'album, stories disponibles), modification et suppression. L'écriture passe
 * par la session serveur : la RLS `owner_id = auth.uid()` reste la règle.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = Id.safeParse((await context.params).id);
  if (!id.success) return fail('not_found', 'Sélection introuvable.');
  try {
    const { data: hl } = await auth.supabase
      .from('story_highlights')
      .select('id,title,cover_story_id')
      .eq('id', id.data)
      .eq('owner_id', auth.user.id)
      .maybeSingle();
    if (!hl) return fail('not_found', 'Sélection introuvable.');

    const { data: items } = await auth.supabase
      .from('story_highlight_items')
      .select('story_id,position')
      .eq('highlight_id', id.data)
      .order('position', { ascending: true });
    const inAlbumIds = ((items ?? []) as Array<{ story_id: string }>).map((item) => item.story_id);

    const { data: mine } = await auth.supabase
      .from('post_stories')
      .select(STORY_COLUMNS)
      .eq('author_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(80);
    const known = new Map(((mine ?? []) as StoryRow[]).map((row) => [row.id, row]));
    const missing = inAlbumIds.filter((storyId) => !known.has(storyId));
    if (missing.length > 0) {
      const { data: extra } = await auth.supabase.from('post_stories').select(STORY_COLUMNS).in('id', missing);
      for (const row of (extra ?? []) as StoryRow[]) known.set(row.id, row);
    }
    const inAlbum = new Set(inAlbumIds);
    return ok({
      id: hl.id,
      title: hl.title ?? '',
      coverStoryId: hl.cover_story_id ?? null,
      stories: inAlbumIds.map((storyId) => known.get(storyId)).filter((row): row is StoryRow => Boolean(row)).map(toStory),
      available: ((mine ?? []) as StoryRow[]).filter((row) => !inAlbum.has(row.id)).map(toStory),
    });
  } catch {
    return fail('server', 'Impossible de charger cette sélection.');
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = Id.safeParse((await context.params).id);
  const body = Patch.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return fail('not_found', 'Modification invalide.');
  try {
    const { data: hl } = await auth.supabase
      .from('story_highlights')
      .select('id')
      .eq('id', id.data)
      .eq('owner_id', auth.user.id)
      .maybeSingle();
    if (!hl) return fail('not_found', 'Sélection introuvable.');

    const { title, coverStoryId, addStoryId, removeStoryId } = body.data;
    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (coverStoryId !== undefined) update.cover_story_id = coverStoryId;
    if (Object.keys(update).length > 0) {
      const { error } = await auth.supabase.from('story_highlights').update(update).eq('id', id.data);
      if (error) return fail('server', 'La modification a échoué.');
    }
    if (addStoryId) {
      const { count } = await auth.supabase
        .from('story_highlight_items')
        .select('story_id', { count: 'exact', head: true })
        .eq('highlight_id', id.data);
      const { error } = await auth.supabase
        .from('story_highlight_items')
        .upsert(
          { highlight_id: id.data, story_id: addStoryId, position: count ?? 0 },
          { onConflict: 'highlight_id,story_id', ignoreDuplicates: true },
        );
      if (error) return fail('server', 'Impossible d’ajouter cette story.');
    }
    if (removeStoryId) {
      const { error } = await auth.supabase
        .from('story_highlight_items')
        .delete()
        .eq('highlight_id', id.data)
        .eq('story_id', removeStoryId);
      if (error) return fail('server', 'Impossible de retirer cette story.');
    }
    return ok({ ok: true });
  } catch {
    return fail('server', 'La modification a échoué.');
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = Id.safeParse((await context.params).id);
  if (!id.success) return fail('not_found', 'Sélection introuvable.');
  const { error } = await auth.supabase.from('story_highlights').delete().eq('id', id.data).eq('owner_id', auth.user.id);
  if (error) return fail('server', 'La suppression a échoué.');
  return ok({ ok: true });
}
