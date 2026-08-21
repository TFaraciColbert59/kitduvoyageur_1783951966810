import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** GET /api/materiel/kits/:id/history — historique des versions d'un kit. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const { data, error } = await supabase
      .from('materiel_kit_history')
      .select('id, action, payload, created_at')
      .eq('kit_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    console.error('GET /api/materiel/kits/:id/history', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}