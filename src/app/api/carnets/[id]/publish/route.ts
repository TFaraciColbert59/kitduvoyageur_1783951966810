import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { awardCarnetPublished } from '@/features/progression/server/producerHooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/carnets/[id]/publish
 *
 * Vérification serveur après une publication de carnet écrite côté client
 * (création publique, bascule de visibilité, édition). L'accroche recalcule en
 * service role la visibilité réelle, le rattachement (voyage/session) et le
 * contenu (moments/médias) avant toute attribution. Réponse 200 dans tous les
 * cas métier : la progression ne bloque jamais la publication.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { data: carnet } = await supabase
      .from('carnets')
      .select('id, author_id')
      .eq('id', id)
      .maybeSingle();
    if (!carnet || carnet.author_id !== user.id) {
      return NextResponse.json({ error: 'Carnet introuvable' }, { status: 404 });
    }

    const result = await awardCarnetPublished(id);
    return NextResponse.json(
      { ok: true, awarded: result.success, outcome: result.outcome, reason: result.reason ?? null },
      { status: 200 }
    );
  } catch (err) {
    console.error('POST /api/carnets/[id]/publish', err);
    return NextResponse.json({ ok: true, awarded: false }, { status: 200 });
  }
}
