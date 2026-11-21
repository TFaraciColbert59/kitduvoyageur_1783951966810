import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

type RequestBody = {
  listingId?: string;
  mode?: 'location' | 'vente' | 'occasion' | 'pret';
  productName?: string;
  priceEur?: number | null;
};

function modeLabelFr(mode: string): string {
  if (mode === 'location') return 'location';
  if (mode === 'pret') return 'prêt';
  return 'achat d’occasion';
}

export async function POST(req: NextRequest) {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Connectez-vous pour envoyer une demande' },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
    const mode = body.mode === 'location' || body.mode === 'pret' ? body.mode : 'vente';
    if (!listingId) {
      return NextResponse.json({ error: 'Annonce manquante' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 });
    }

    const admin = createSupabaseAdmin(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: listing, error: lErr } = await admin
      .from('marketplace_listings')
      .select('id, owner_id, name, mode, price_cents')
      .eq('id', listingId)
      .maybeSingle();

    if (lErr || !listing) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }

    const ownerId = String(listing.owner_id);
    const productName = String(listing.name || body.productName || 'Matériel outdoor');
    const effectiveMode =
      listing.mode === 'location' || listing.mode === 'pret' || listing.mode === 'vente'
        ? listing.mode
        : mode;
    const priceEur =
      typeof body.priceEur === 'number'
        ? body.priceEur
        : typeof listing.price_cents === 'number' && listing.price_cents > 0
          ? Math.round(listing.price_cents / 100)
          : null;

    if (ownerId === user.id) {
      return NextResponse.json(
        { error: 'Vous êtes déjà le propriétaire de cette annonce' },
        { status: 400 }
      );
    }

    const { data: senderProfile } = await admin
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    const senderName = senderProfile?.full_name || 'Un voyageur LKDV';

    // 1. Trouver ou créer la conversation directe entre demandeur et propriétaire
    const pairKey = [user.id, ownerId].sort().join(':');
    let conversationId: string | null = null;

    const { data: existingConv } = await admin
      .from('conversations')
      .select('id')
      .eq('type', 'direct')
      .eq('direct_pair_key', pairKey)
      .maybeSingle();

    if (existingConv?.id) {
      conversationId = existingConv.id;
    } else {
      const nowIso = new Date().toISOString();
      const { data: createdConv, error: cErr } = await admin
        .from('conversations')
        .insert({
          type: 'direct',
          name: 'Conversation directe',
          direct_pair_key: pairKey,
          members_count: 2,
          created_by: user.id,
          last_message_at: nowIso,
        })
        .select('id')
        .single();
      if (cErr || !createdConv?.id) {
        return NextResponse.json(
          { error: cErr?.message || 'Impossible de créer la conversation' },
          { status: 500 }
        );
      }
      conversationId = createdConv.id;

      await admin.from('conversation_members').insert([
        { conversation_id: conversationId, user_id: user.id, role: 'member' },
        { conversation_id: conversationId, user_id: ownerId, role: 'member' },
      ]);
    }

    // 2. Envoyer le message dans la conversation
    const modeTxt = modeLabelFr(effectiveMode);
    const priceSuffix =
      effectiveMode === 'pret'
        ? ''
        : priceEur !== null
          ? effectiveMode === 'location'
            ? ` (${priceEur} € / j)`
            : ` (${priceEur} €)`
          : '';
    const msgContent =
      effectiveMode === 'pret'
        ? `Bonjour ! Serait-il possible d’emprunter votre « ${productName} » pour ma prochaine sortie ?`
        : effectiveMode === 'location'
          ? `Bonjour ! Je souhaite louer votre « ${productName} »${priceSuffix}. Est-il disponible ?`
          : `Bonjour ! Je suis intéressé(e) par l’achat d’occasion de votre « ${productName} »${priceSuffix}.`;

    const { error: mErr } = await admin.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: msgContent,
      type: 'text',
      message_type: 'text',
      metadata: {
        kind: 'marketplace_request',
        mode: effectiveMode,
        listingId: listing.id,
        productName,
        priceEur,
      },
    });
    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    await admin
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // 3. Envoyer la notification au propriétaire
    const notifTitle =
      effectiveMode === 'pret'
        ? `Demande de prêt · ${productName}`
        : effectiveMode === 'location'
          ? `Demande de location · ${productName}`
          : `Demande d’occasion · ${productName}`;

    await admin.from('notifications').insert({
      user_id: ownerId,
      actor_id: user.id,
      type: 'new_message',
      title: notifTitle,
      message: `${senderName} vous a envoyé une demande de ${modeTxt} pour ${productName}${priceSuffix}.`,
      read: false,
      related_type: 'conversation',
      related_id: conversationId,
      link: `/messagerie?conversation=${conversationId}`,
    });

    return NextResponse.json({
      ok: true,
      conversationId,
      mode: effectiveMode,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
