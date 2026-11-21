import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Récupérer le carnet
    const { data: carnet, error: carnetError } = await supabase
      .from('carnets')
      .select('id, title, description, destination, cover_image, visibility, created_at')
      .eq('id', id)
      .maybeSingle();

    if (carnetError || !carnet) {
      return NextResponse.json({ error: 'Carnet introuvable' }, { status: 404 });
    }

    // Récupérer les moments (manuels + auto)
    const { data: moments } = await supabase
      .from('carnet_moments')
      .select('id, citation, heure, lieu, image_url, moment_timestamp, source, hike_session_id, jour_numero, created_at')
      .eq('carnet_id', id)
      .order('moment_timestamp', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    return NextResponse.json({
      carnet,
      moments: moments || [],
    });
  } catch (err) {
    console.error('[GET /api/carnets/[id]]', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string | null;
      destination?: string | null;
      visibility?: string;
      startDate?: string | null;
      endDate?: string | null;
    };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const db =
      url && serviceKey
        ? createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false } })
        : supabase;

    const { data: existing } = await db
      .from('carnets')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Carnet introuvable' }, { status: 404 });
    }

    let canEdit = existing.user_id === user.id;
    if (!canEdit) {
      const { data: part } = await db
        .from('carnet_participants')
        .select('role')
        .eq('carnet_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      canEdit = Boolean(part && ['owner', 'author', 'editor', 'member', 'membre'].includes(String(part.role).toLowerCase()));
    }
    if (!canEdit) {
      return NextResponse.json({ error: 'Droits insuffisants pour modifier ce carnet' }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
    if (body.description !== undefined) patch.description = body.description ? body.description.trim() : null;
    if (body.destination !== undefined) patch.destination = body.destination ? body.destination.trim() : null;
    if (typeof body.visibility === 'string' && ['public', 'private', 'friends', 'unlisted'].includes(body.visibility)) {
      patch.visibility = body.visibility;
    }
    if (body.startDate !== undefined) patch.start_date = body.startDate || null;
    if (body.endDate !== undefined) patch.end_date = body.endDate || null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }

    const { data: updated, error: uErr } = await db
      .from('carnets')
      .update(patch)
      .eq('id', id)
      .select('id, title, description, destination, visibility, start_date, end_date')
      .single();

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, carnet: updated });
  } catch (err) {
    console.error('[PATCH /api/carnets/[id]]', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
