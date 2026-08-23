import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { productOwnershipSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/materiel/items — ajouter un objet d'inventaire (product_ownership). */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const parsed = productOwnershipSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('product_ownership')
      .insert({ user_id: user.id, ...parsed.data })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/materiel/items', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/** GET /api/materiel/items — lister l'inventaire de l'utilisateur. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { data, error } = await supabase
      .from('product_ownership')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    console.error('GET /api/materiel/items', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
