import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { reportId } = await req.json();
    if (!reportId) {
      return NextResponse.json({ error: 'reportId manquant' }, { status: 400 });
    }

    // Fetch the report
    const { data: report, error: fetchError } = await supabase
      .from('kit_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
    }

    if (report.converted_to_inventory) {
      return NextResponse.json({ error: 'Déjà converti en inventaire' }, { status: 400 });
    }

    // Convert each selected item to a gear_item
    const items = (report.selected_items as Array<{
      id: string;
      name: string;
      brand: string;
      category: string;
      weight_g: number;
      price_eur: number;
      image?: string;
      image_alt?: string;
    }>) ?? [];

    const gearItems = items.map(item => ({
      user_id: user.id,
      name: item.name,
      brand: item.brand ?? '',
      model: '',
      category: mapCategory(item.category),
      condition: 'neuf' as const,
      purchase_date: new Date().toISOString().split('T')[0],
      purchase_price: item.price_eur ?? 0,
      weight_g: item.weight_g ?? 0,
      notes: `Ajouté depuis le rapport kit — ${report.destination}`,
      usage_count: 0,
      image: item.image ?? 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30',
      alt: item.image_alt ?? item.name,
      tags: [report.activity, report.destination].filter(Boolean),
      source_report_id: reportId,
    }));

    if (gearItems.length > 0) {
      const { error: insertError } = await supabase
        .from('gear_items')
        .insert(gearItems);

      if (insertError) throw insertError;
    }

    // Mark report as converted
    await supabase
      .from('kit_reports')
      .update({
        converted_to_inventory: true,
        converted_at: new Date().toISOString(),
        status: 'purchased',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, itemsAdded: gearItems.length });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}

function mapCategory(cat: string): string {
  const map: Record<string, string> = {
    'Sac': 'sac',
    'Abri': 'abri',
    'Couchage': 'couchage',
    'Vêtement': 'vêtement',
    'Chaussure': 'chaussure',
    'Cuisine': 'cuisine',
    'Eau': 'eau',
    'Navigation': 'navigation',
    'Sécurité': 'sécurité',
    'Électronique': 'électronique',
  };
  return map[cat] ?? 'autre';
}
