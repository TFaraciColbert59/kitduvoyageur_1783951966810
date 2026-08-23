import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { materielKitSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/materiel/kits — créer un kit utilisateur (materiel_kits + items). */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const parsed = materielKitSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      );
    }

    const { items, ...kit } = parsed.data;

    const { data: created, error } = await supabase
      .from('materiel_kits')
      .insert({ user_id: user.id, ...kit })
      .select('*')
      .single();
    if (error) throw error;

    if (items && items.length > 0) {
      const rows = items.map((i) => ({
        kit_id: created.id,
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

    await supabase.from('materiel_kit_history').insert({
      kit_id: created.id,
      user_id: user.id,
      action: 'created',
      payload: { item_count: items?.length ?? 0 },
    });

    return NextResponse.json({ kit: created }, { status: 201 });
  } catch (err) {
    console.error('POST /api/materiel/kits', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/** GET /api/materiel/kits — lister les kits de l'utilisateur (avec articles). */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { data: kits, error } = await supabase
      .from('materiel_kits')
      .select('*, materiel_kit_items(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ kits: kits ?? [] });
  } catch (err) {
    console.error('GET /api/materiel/kits', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
