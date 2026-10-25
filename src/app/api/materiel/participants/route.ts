import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { participantSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/materiel/participants — ajoute un participant à un départ (kit). */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const parsed = participantSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalide' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('depart_participants')
      .insert({ user_id: user.id, ...parsed.data })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json({ participant: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/materiel/participants', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
