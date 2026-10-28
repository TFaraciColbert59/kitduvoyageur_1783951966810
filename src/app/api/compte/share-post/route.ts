import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Extrait texte utilisé comme contenu de message quand la publication n'a pas de titre. */
const EXCERPT_MAX = 80;

function firstUsableMedia(mediaUrls: unknown, imageUrl: unknown): string | null {
  const candidates = Array.isArray(mediaUrls) ? [...mediaUrls, imageUrl] : [imageUrl];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const url = candidate.trim();
    if (url) return url;
  }
  return null;
}

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
  const rows = (conversations ?? []) as Array<{
    id: string;
    title: string | null;
    name: string | null;
    type: string | null;
    avatar_url: string | null;
    last_message_at: string | null;
  }>;
  // Conversations directes : l'avatar n'est pas porté par la conversation.
  // On complète avec le profil de l'autre membre pour que le partage affiche
  // une vraie photo de profil au lieu d'une initiale.
  const directIds = rows.filter((c) => c.type === 'direct' && !c.avatar_url).map((c) => c.id);
  if (directIds.length) {
    const { data: members } = await supabase
      .from('conversation_members')
      .select('conversation_id,user_id')
      .in('conversation_id', directIds);
    const otherByConversation = new Map<string, string>();
    for (const member of (members ?? []) as Array<{ conversation_id: string; user_id: string }>) {
      if (member.user_id !== auth.user.id) otherByConversation.set(member.conversation_id, member.user_id);
    }
    const idsToLoad = Array.from(new Set(otherByConversation.values()));
    if (idsToLoad.length) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id,full_name,avatar_url')
        .in('id', idsToLoad);
      const profilesById = new Map(
        ((profiles ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map((p) => [p.id, p])
      );
      for (const conversation of rows) {
        const otherId = otherByConversation.get(conversation.id);
        const profile = otherId ? profilesById.get(otherId) : null;
        if (profile) {
          conversation.avatar_url = profile.avatar_url;
          if (!conversation.title && !conversation.name) {
            conversation.name = profile.full_name;
            conversation.title = profile.full_name;
          }
        }
      }
    }
  }
  return NextResponse.json({ conversations: rows });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = await req.json().catch(() => null);
  const body =
    parsed && typeof parsed === 'object'
      ? (parsed as { postId?: unknown; conversationId?: unknown })
      : {};
  const postId = typeof body.postId === 'string' ? body.postId.trim() : '';
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  if (!postId || !conversationId) return NextResponse.json({ error: 'missing' }, { status: 400 });

  // Sécurité : seul un membre ACTIF de la conversation peut y publier le partage.
  // La policy INSERT de messages l'exige déjà ; on renvoie ici un refus explicite
  // sans révéler l'existence de la publication aux non-membres.
  const { data: membership, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id,left_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (membershipError) {
    return NextResponse.json({ error: 'membership_check_failed' }, { status: 500 });
  }
  if (!membership || membership.left_at) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: post } = await supabase
    .from('community_posts')
    .select('id,title,content,image_url,media_urls,author_id')
    .eq('id', postId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'post_not_found' }, { status: 404 });

  let authorName: string | null = null;
  let authorAvatar: string | null = null;
  if (post.author_id) {
    const { data: author } = await supabase
      .from('public_profiles')
      .select('full_name,avatar_url')
      .eq('id', post.author_id)
      .maybeSingle();
    authorName = typeof author?.full_name === 'string' ? author.full_name.trim() || null : null;
    authorAvatar = typeof author?.avatar_url === 'string' ? author.avatar_url.trim() || null : null;
  }

  const rawTitle = typeof post.title === 'string' ? post.title.trim() : '';
  const rawContent = typeof post.content === 'string' ? post.content.trim() : '';
  const excerpt = rawContent.slice(0, EXCERPT_MAX);
  const content = rawTitle || excerpt || 'Publication LKDV';
  // La carte n'a qu'un champ éditorial : le titre, sinon l'extrait, pour
  // qu'une publication sans titre affiche tout de même son contenu.
  const displayTitle = rawTitle || excerpt || null;
  const postUrl = `/communaute?post=${postId}`;

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: auth.user.id,
      content,
      message_type: 'post',
      metadata: {
        post_id: postId,
        post_url: postUrl,
        title: displayTitle,
        image_url: firstUsableMedia(post.media_urls, post.image_url),
        author_name: authorName,
        author_avatar: authorAvatar,
      },
    })
    .select('id')
    .single();
  if (error || !message)
    return NextResponse.json({ error: error?.message || 'message_failed' }, { status: 400 });

  await supabase.from('post_shares').insert({
    post_id: postId,
    user_id: auth.user.id,
    conversation_id: conversationId,
    message_id: message.id,
  });

  return NextResponse.json({ ok: true, url: postUrl });
}
