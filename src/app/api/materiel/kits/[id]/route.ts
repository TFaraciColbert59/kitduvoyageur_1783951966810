import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { materielKitSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/materiel/kits/:id — mettre à jour un kit (remplace ses articles). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const parsed = materielKitSchema.partial().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      );
    }

    const { items, ...patch } = parsed.data;

    const { data, error } = await supabase
      .from('materiel_kits')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) throw error;

    if (items) {
      await supabase.from('materiel_kit_items').delete().eq('kit_id', id);
      if (items.length > 0) {
        const rows = items.map((i) => ({
          kit_id: id,
          user_id: user.id,
          product_ownership_id: i.product_ownership_id ?? null,
          name: i.name,
          category: i.category,
          weight_g: i.weight_g,
          quantity: i.quantity,
          is_checked: i.is_checked,
        }));
        const { error: itemsError } = await supabase.from('materiel_kit_items').insert(rows);
        if (itemsError) throw itemsError;
      }
    }

    return NextResponse.json({ kit: data });
  } catch (err) {
    console.error('PATCH /api/materiel/kits/:id', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/** DELETE /api/materiel/kits/:id — suppression définitive d'un kit. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const { error } = await supabase
      .from('materiel_kits')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error('DELETE /api/materiel/kits/:id', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
