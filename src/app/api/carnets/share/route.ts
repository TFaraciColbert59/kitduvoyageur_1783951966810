import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Extrait texte utilisé comme contenu de message quand le carnet n'a pas de titre. */
const EXCERPT_MAX = 80;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = await req.json().catch(() => null);
  const body =
    parsed && typeof parsed === 'object'
      ? (parsed as { carnetId?: unknown; conversationId?: unknown })
      : {};
  const carnetId = typeof body.carnetId === 'string' ? body.carnetId.trim() : '';
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  if (!carnetId || !conversationId) return NextResponse.json({ error: 'missing' }, { status: 400 });

  // Sécurité : seul un membre ACTIF de la conversation peut y publier le partage.
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

  const { data: carnet } = await supabase
    .from('carnets')
    .select('id,title,description,destination,cover_image,author_id,visibility')
    .eq('id', carnetId)
    .eq('visibility', 'public')
    .maybeSingle();
  if (!carnet) return NextResponse.json({ error: 'carnet_not_found' }, { status: 404 });

  let authorName: string | null = null;
  let authorAvatar: string | null = null;
  if (carnet.author_id) {
    const { data: author } = await supabase
      .from('public_profiles')
      .select('full_name,avatar_url')
      .eq('id', carnet.author_id)
      .maybeSingle();
    authorName = typeof author?.full_name === 'string' ? author.full_name.trim() || null : null;
    authorAvatar = typeof author?.avatar_url === 'string' ? author.avatar_url.trim() || null : null;
  }

  const rawTitle = typeof carnet.title === 'string' ? carnet.title.trim() : '';
  const rawContent = typeof carnet.description === 'string' ? carnet.description.trim() : '';
  const excerpt = rawContent.slice(0, EXCERPT_MAX);
  const content = rawTitle || excerpt || 'Carnet LKDV';
  const displayTitle = rawTitle || excerpt || null;
  const carnetUrl = `/carnets/${carnetId}`;

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: auth.user.id,
      content,
      message_type: 'carnet',
      metadata: {
        carnet_id: carnetId,
        carnet_url: carnetUrl,
        title: displayTitle,
        image_url: typeof carnet.cover_image === 'string' && carnet.cover_image.trim() ? carnet.cover_image.trim() : null,
        destination: typeof carnet.destination === 'string' ? carnet.destination : null,
        author_name: authorName,
        author_avatar: authorAvatar,
      },
    })
    .select('id')
    .single();
  if (error || !message)
    return NextResponse.json({ error: error?.message || 'message_failed' }, { status: 400 });

  return NextResponse.json({ ok: true, url: carnetUrl });
}
