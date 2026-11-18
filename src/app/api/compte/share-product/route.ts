import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProductMessageMeta } from '@/features/messaging/types/messaging.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = await req.json().catch(() => null);
  const body =
    parsed && typeof parsed === 'object'
      ? (parsed as {
          conversationId?: unknown;
          productId?: unknown;
          name?: unknown;
          photoUrl?: unknown;
          category?: unknown;
          priceCents?: unknown;
        })
      : {};

  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!conversationId || !name) return NextResponse.json({ error: 'missing' }, { status: 400 });

  const { data: membership, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id,left_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: 'membership_check_failed' }, { status: 500 });
  }
  if (!membership || membership.left_at) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const metadata: ProductMessageMeta = {
    kind: 'product',
    id: productId || name,
    name,
    photo_url: typeof body.photoUrl === 'string' && body.photoUrl.trim() ? body.photoUrl.trim() : null,
    category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null,
    price_cents: typeof body.priceCents === 'number' && Number.isFinite(body.priceCents) ? body.priceCents : null,
  };

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: auth.user.id,
      content: name,
      message_type: 'product',
      metadata,
    })
    .select('id')
    .single();

  if (error || !message) {
    return NextResponse.json({ error: error?.message || 'message_failed' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: message.id });
}
