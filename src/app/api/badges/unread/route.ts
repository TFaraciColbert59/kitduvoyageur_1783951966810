import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Compteurs réels de non-lus / nouveaux contenus pour les badges de la bottom bar.
 * Source par onglet (0 = aucun badge, jamais de valeur factice).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const out = {
      materiel: 0,
      communaute: 0,
      profil: 0,
      messages: 0,
    };

    if (!user) {
      return NextResponse.json(out);
    }

    // Matériel : alertes actives (RLS) non résolues
    try {
      const { count: alerts } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_resolved', false);
      out.materiel = alerts ?? 0;
    } catch {
      out.materiel = 0;
    }

    // Messagerie : somme des compteurs non-lus (RLS conversation_members)
    try {
      const { data: unreadRows } = await supabase
        .from('conversation_members')
        .select('unread_count')
        .eq('user_id', user.id);
      out.messages = (unreadRows ?? []).reduce(
        (sum, row) => sum + (row.unread_count || 0),
        0
      );
    } catch {
      out.messages = 0;
    }

    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ materiel: 0, communaute: 0, profil: 0, messages: 0 });
  }
}
