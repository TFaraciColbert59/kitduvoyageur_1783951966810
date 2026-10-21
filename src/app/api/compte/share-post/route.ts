import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ conversations: [] });
  const { data: memberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', auth.user.id)
    .limit(50);
  const ids = (memberships ?? []).map((m) => m.conversation_id);
  if (!ids.length) return NextResponse.json({ conversations: [] });
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id,title,name,type,avatar_url,last_message_at')
    .in('id', ids)
    .order('last_message_at', { ascending: false })
    .limit(50);
  return NextResponse.json({ conversations: conversations ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const postId = String(body.postId || '');
  const conversationId = String(body.conversationId || '');
  if (!postId || !conversationId) return NextResponse.json({ error: 'missing' }, { status: 400 });

  const { data: post } = await supabase
    .from('community_posts')
    .select('id,title,content')
    .eq('id', postId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'post_not_found' }, { status: 404 });

  const origin = new URL(req.url).origin;
  const url = `${origin}/communaute/post/${postId}`;
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: auth.user.id,
      content: post.title || post.content?.slice(0, 80) || 'Publication LKDV',
      message_type: 'post',
      metadata: { post_id: postId, post_url: url, title: post.title || null },
    })
    .select('id')
    .single();
  if (error || !message) return NextResponse.json({ error: error?.message || 'message_failed' }, { status: 400 });

  await supabase.from('post_shares').insert({
    post_id: postId,
    user_id: auth.user.id,
    conversation_id: conversationId,
    message_id: message.id,
  });

  return NextResponse.json({ ok: true, url });
}
