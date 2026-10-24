import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('view') }),
  z.object({ action: z.literal('like') }),
  z.object({ action: z.literal('unlike') }),
  z.object({ action: z.literal('comment'), content: z.string().trim().min(1).max(500) }),
]);

type Params = { params: Promise<{ id: string }> };

async function profilesFor(
  supabase: any,
  ids: string[]
) {
  if (!ids.length) return new Map<string, { name: string; handle: string; avatarUrl: string | null }>();
  const { data } = await supabase
    .from('public_profiles')
    .select('id,full_name,handle,avatar_url')
    .in('id', ids);
  return new Map(
    (data ?? []).map((row: { id: string; full_name?: string | null; handle?: string | null; avatar_url?: string | null }) => [
      row.id,
      { name: row.full_name || row.handle || 'Voyageur', handle: row.handle || '', avatarUrl: row.avatar_url || null },
    ])
  );
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Story inconnue.' }, { status: 400 });
  }
  const supabase = auth.supabase;
  const [likes, views, liked, comments] = await Promise.all([
    supabase.from('story_likes').select('user_id').eq('story_id', id),
    supabase.from('story_views').select('viewer_id,last_viewed_at').eq('story_id', id).order('last_viewed_at', { ascending: false }).limit(60),
    supabase.from('story_likes').select('story_id').eq('story_id', id).eq('user_id', auth.user.id).maybeSingle(),
    supabase.from('story_comments').select('id,author_id,content,created_at').eq('story_id', id).order('created_at', { ascending: true }).limit(100),
  ]);

  const commentRows = comments.data ?? [];
  const viewerRows = views.data ?? [];
  const ids = [...new Set([
    ...commentRows.map((row) => row.author_id as string),
    ...viewerRows.map((row) => row.viewer_id as string),
  ])];
  const profiles = await profilesFor(supabase, ids);

  return NextResponse.json({
    liked: Boolean(liked.data),
    likeCount: likes.data?.length ?? 0,
    viewCount: viewerRows.length,
    viewers: viewerRows.map((row) => ({
      id: row.viewer_id,
      ...(profiles.get(row.viewer_id as string) ?? { name: 'Voyageur', handle: '', avatarUrl: null }),
      viewedAt: row.last_viewed_at,
    })),
    comments: commentRows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      author: { id: row.author_id, ...(profiles.get(row.author_id as string) ?? { name: 'Voyageur', handle: '', avatarUrl: null }) },
    })),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Story inconnue.' }, { status: 400 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  const supabase = auth.supabase;
  const now = new Date().toISOString();

  if (parsed.data.action === 'view') {
    await supabase.from('story_views').upsert(
      { story_id: id, viewer_id: auth.user.id, first_viewed_at: now, last_viewed_at: now },
      { onConflict: 'story_id,viewer_id', ignoreDuplicates: false }
    );
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'like' || parsed.data.action === 'unlike') {
    if (parsed.data.action === 'like') {
      await supabase.from('story_likes').upsert(
        { story_id: id, user_id: auth.user.id, created_at: now },
        { onConflict: 'story_id,user_id', ignoreDuplicates: true }
      );
    } else {
      await supabase.from('story_likes').delete().eq('story_id', id).eq('user_id', auth.user.id);
    }
    const { count } = await supabase.from('story_likes').select('user_id', { count: 'exact', head: true }).eq('story_id', id);
    return NextResponse.json({ ok: true, liked: parsed.data.action === 'like', likeCount: count ?? 0 });
  }
  const { data, error } = await supabase
    .from('story_comments')
    .insert({ story_id: id, author_id: auth.user.id, content: parsed.data.content })
    .select('id,author_id,content,created_at')
    .single();
  if (error) return NextResponse.json({ error: 'Commentaire impossible.' }, { status: 500 });
  return NextResponse.json({ ok: true, comment: data });
}
