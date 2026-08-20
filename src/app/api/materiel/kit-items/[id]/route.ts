import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const ToggleSchema = z.object({ is_checked: z.boolean() });

/** PATCH /api/materiel/kit-items/:id — coche/décoche un article de kit. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const parsed = ToggleSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Valeur invalide' }, { status: 400 });

    const { data, error } = await supabase
      .from('materiel_kit_items')
      .update({ is_checked: parsed.data.is_checked })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('PATCH /api/materiel/kit-items/:id', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
