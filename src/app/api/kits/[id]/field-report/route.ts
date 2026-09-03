import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fieldReportSchema, buildFieldReportItemKey } from '@/features/kits/fieldProof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/kits/[id]/field-report
 * Débriefing terrain d'un item du kit après randonnée (upsert).
 * - La session doit appartenir à l'utilisateur ET être rattachée à ce kit.
 * - Upsert sur (hike_session_id, item_key) — un débriefing abandonné puis repris
 *   ne crée jamais de doublon.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const parsed = fieldReportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Débriefing invalide' },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // La session doit appartenir à l'utilisateur et porter ce kit.
    const { data: session, error: sessionError } = await supabase
      .from('hike_sessions')
      .select('user_id, kit_id')
      .eq('id', body.hike_session_id)
      .maybeSingle();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
    }
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session non autorisée' }, { status: 403 });
    }
    if (!session.kit_id || session.kit_id !== params.id) {
      return NextResponse.json(
        { error: 'Cette session n’est pas rattachée à ce kit' },
        { status: 400 }
      );
    }

    const itemKey = buildFieldReportItemKey({
      productId: body.product_id,
      name: body.name,
    });
    if (!itemKey) {
      return NextResponse.json(
        { error: 'Un article (lien catalogue ou nom) est requis' },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabase
      .from('kit_field_reports')
      .upsert(
        {
          kit_id: params.id,
          hike_session_id: body.hike_session_id,
          user_id: user.id,
          item_key: itemKey,
          product_id: body.product_id ?? null,
          verdict: body.verdict,
          note: body.note ?? null,
        },
        { onConflict: 'hike_session_id,item_key' }
      );

    if (upsertError) throw upsertError;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('POST /api/kits/[id]/field-report', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}