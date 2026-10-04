import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeGtin } from '@/features/materiel/domain/gtin';
import { getInventoryCatalog } from '@/features/materiel/services/getInventoryCatalog';
export async function GET(req: NextRequest) {
  const code = normalizeGtin(req.nextUrl.searchParams.get('barcode') ?? '');
  if (!code)
    return NextResponse.json(
      { error: 'Code GTIN/EAN invalide. Ce champ ne vérifie pas les numéros de série.' },
      { status: 400 }
    );
  try {
    const db = await createClient();
    const { data, error } = await db
      .from('shop_products')
      .select('id')
      .eq('ean', code)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(2);
    if (error) throw error;
    if (!data?.length)
      return NextResponse.json(
        { error: 'Aucune référence dans notre catalogue. Vous pouvez créer un objet libre.' },
        { status: 404 }
      );
    if (data.length !== 1)
      return NextResponse.json(
        { error: 'Plusieurs références correspondent : choisissez la fiche dans le catalogue.' },
        { status: 409 }
      );
    const [product] = await getInventoryCatalog([data[0].id]);
    if (!product) return NextResponse.json({ error: 'Référence indisponible' }, { status: 404 });
    return NextResponse.json({
      product,
      source: 'catalogue_lkdv',
      verification: 'reference_catalogue',
      message:
        'Correspondance catalogue uniquement : authenticité, garantie et historique non vérifiés.',
    });
  } catch {
    return NextResponse.json({ error: 'Catalogue temporairement indisponible' }, { status: 503 });
  }
}
