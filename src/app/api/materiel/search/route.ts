import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/materiel/search?q=... — recherche kits + items (tsvector / ILIKE). */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (!q) return NextResponse.json({ results: [] });

    const pattern = `%${q}%`;
    const [kits, items] = await Promise.all([
      supabase
        .from('materiel_kits')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .ilike('name', pattern)
        .limit(8),
      supabase
        .from('product_ownership')
        .select('id, name, brand')
        .eq('user_id', user.id)
        .ilike('name', pattern)
        .limit(8),
    ]);

    const results = [
      ...(kits.data ?? []).map((k) => ({ id: k.id, type: 'kit', label: k.name, sublabel: 'Kit', href: `/materiel/kits` })),
      ...(items.data ?? []).map((i) => ({ id: i.id, type: 'item', label: i.name, sublabel: i.brand ?? 'Objet', href: `/materiel/inventaire` })),
    ].slice(0, 12);

    return NextResponse.json({ results });
  } catch (err) {
    console.error('GET /api/materiel/search', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
