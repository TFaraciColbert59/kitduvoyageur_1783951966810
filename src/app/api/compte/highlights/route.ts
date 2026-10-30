import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Create = z
  .object({
    title: z.string().trim().min(1).max(60),
    coverStoryId: z.string().uuid().nullable().optional(),
    storyIds: z.array(z.string().uuid()).max(100).optional(),
  })
  .strict();

interface StoryRow {
  id: string;
  image_url: string | null;
  storage_path: string | null;
  media_type: string | null;
  caption: string | null;
}

/** Stories du propriétaire que l'on peut ranger dans une sélection à la une. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    const { data } = await auth.supabase
      .from('post_stories')
      .select('id,image_url,storage_path,media_type,caption')
      .eq('author_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(80);
    return ok({
      available: ((data ?? []) as StoryRow[]).map((row) => ({
        id: row.id,
        image: row.image_url || (row.storage_path ? `/api/stories/${row.id}/media` : ''),
        caption: row.caption || '',
        isVideo: row.media_type === 'video',
      })),
    });
  } catch {
    return fail('server', 'Impossible de charger tes stories.');
  }
}

/** Crée une vraie sélection à la une (par ex. à partir d'une sélection générée automatiquement). */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = Create.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('not_found', 'Sélection invalide.');
  try {
    const { count } = await auth.supabase
      .from('story_highlights')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', auth.user.id);
    const { data: created, error } = await auth.supabase
      .from('story_highlights')
      .insert({
        owner_id: auth.user.id,
        title: body.data.title,
        cover_story_id: body.data.coverStoryId ?? null,
        position: count ?? 0,
      })
      .select('id')
      .single();
    if (error || !created) return fail('server', 'La création a échoué.');
    const storyIds = body.data.storyIds ?? [];
    if (storyIds.length > 0) {
      const { error: itemsError } = await auth.supabase
        .from('story_highlight_items')
        .insert(storyIds.map((storyId, position) => ({ highlight_id: created.id, story_id: storyId, position })));
      if (itemsError) return fail('server', 'La sélection est créée, mais ses stories n’ont pas pu être ajoutées.');
    }
    return ok({ id: created.id }, 201);
  } catch {
    return fail('server', 'La création a échoué.');
  }
}
