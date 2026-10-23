import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

function timeLabel(value?: string | null) {
  if (!value) return 'À l’instant';
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  const { data: comments, error } = await supabase
    .from('post_comments')
    .select('id,post_id,author_id,content,parent_id,created_at')
    .eq('post_id', id)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ comments: [] }, { status: 200 });

  const ids = [...new Set((comments ?? []).map((c) => c.author_id).filter(Boolean))];
  const commentIds = (comments ?? []).map((c) => c.id);

  const [profilesRes, likesRes] = await Promise.all([
    ids.length
      ? supabase.from('public_profiles').select('id,handle,full_name,avatar_url').in('id', ids)
      : Promise.resolve({ data: [] }),
    commentIds.length
      ? supabase.from('post_comment_likes').select('comment_id,user_id').in('comment_id', commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
  const likes = new Map<string, { count: number; liked: boolean }>();
  for (const like of likesRes.data ?? []) {
    const entry = likes.get(like.comment_id) ?? { count: 0, liked: false };
    entry.count += 1;
    if (userId && like.user_id === userId) entry.liked = true;
    likes.set(like.comment_id, entry);
  }

  return NextResponse.json({
    comments: (comments ?? []).map((c) => {
      const p: any = profiles.get(c.author_id);
      const l = likes.get(c.id) ?? { count: 0, liked: false };
      return {
        id: c.id,
        author_id: c.author_id,
        parent_id: c.parent_id,
        user: p?.handle || p?.full_name || 'voyageur',
        name: p?.full_name || p?.handle || 'Voyageur',
        avatar: p?.avatar_url || null,
        text: c.content,
        time: timeLabel(c.created_at),
        likes: l.count,
        liked: l.liked,
      };
    }),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'create';

  if (action === 'like' && body.commentId) {
    const { data: existing } = await supabase
      .from('post_comment_likes')
      .select('id')
      .eq('comment_id', body.commentId)
      .eq('user_id', user.id)
      .maybeSingle();
    const res = existing
      ? await supabase.from('post_comment_likes').delete().eq('id', existing.id)
      : await supabase.from('post_comment_likes').insert({ comment_id: body.commentId, user_id: user.id });
    return NextResponse.json({ ok: !res.error, liked: !existing });
  }

  if (action === 'report' && body.commentId) {
    const { error } = await supabase.from('comment_reports').insert({
      comment_id: body.commentId,
      reporter_id: user.id,
      reason: body.reason || 'Signalement',
      table_name: 'post_comments',
    });
    return NextResponse.json({ ok: !error });
  }

  const content = String(body.content || '').trim();
  if (!content) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const { error } = await supabase.from('post_comments').insert({
    post_id: id,
    author_id: user.id,
    content,
    parent_id: body.parentId || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
