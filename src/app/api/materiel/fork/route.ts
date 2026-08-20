import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ForkSchema = z.object({ kit_id: z.string().uuid() });

/** POST /api/materiel/fork — duplique un kit (public ou propre) avec ses articles. */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const parsed = ForkSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Kit invalide' }, { status: 400 });

    const { data: source, error } = await supabase
      .from('materiel_kits')
      .select('*, materiel_kit_items(*)')
      .eq('id', parsed.data.kit_id)
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .maybeSingle();
    if (error || !source) return NextResponse.json({ error: 'Kit introuvable' }, { status: 404 });

    const { data: newKit, error: kitError } = await supabase
      .from('materiel_kits')
      .insert({
        user_id: user.id,
        name: `${source.name} (copie)`,
        description: source.description,
        season: source.season,
        total_weight_g: source.total_weight_g,
        is_public: false,
        tags: source.tags,
      })
      .select('*')
      .single();
    if (kitError) throw kitError;

    const items = (source.materiel_kit_items ?? []) as { product_ownership_id: string | null; name: string | null; category: string | null; weight_g: number | null; quantity: number; is_checked: boolean }[];
    if (items.length > 0) {
      const rows = items.map((i) => ({
        kit_id: newKit.id,
        user_id: user.id,
        product_ownership_id: i.product_ownership_id ?? null,
        name: i.name ?? 'Article',
        category: i.category ?? 'Autre',
        weight_g: i.weight_g ?? 0,
        quantity: i.quantity ?? 1,
        is_checked: false,
      }));
      const { error: itemsError } = await supabase.from('materiel_kit_items').insert(rows);
      if (itemsError) throw itemsError;
    }

    await supabase.from('materiel_kit_history').insert({
      kit_id: newKit.id,
      user_id: user.id,
      action: 'forked',
      payload: { source_kit_id: source.id },
    });

    return NextResponse.json({ kit: newKit }, { status: 201 });
  } catch (err) {
    console.error('POST /api/materiel/fork', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
