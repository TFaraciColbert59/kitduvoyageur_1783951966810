import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/materiel/export — export inventaire ou kit (CSV / JSON / GPX). */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const parsed = exportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      );
    }

    const { format, scope, kit_id } = parsed.data;

    if (scope === 'inventory') {
      const { data: items, error } = await supabase
        .from('product_ownership')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;

      if (format === 'json') {
        return NextResponse.json({ items: items ?? [] });
      }
      if (format === 'csv') {
        const header = ['Nom', 'Marque', 'Catégorie', 'Poids(g)', 'Prix(ct)', 'État'];
        const rows = (items ?? []).map((i) =>
          [i.name, i.brand ?? '', i.category ?? '', i.weight_g ?? 0, i.price_cents ?? 0, i.condition ?? '']
            .map((c) => `"${String(c).replace(/"/g, '""')}"`)
            .join(',')
        );
        const csv = [header.join(','), ...rows].join('\n');
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="inventaire.csv"',
          },
        });
      }
    }

    if (scope === 'kit' && kit_id) {
      const { data: kit, error } = await supabase
        .from('materiel_kits')
        .select('*, materiel_kit_items(*)')
        .eq('id', kit_id)
        .eq('user_id', user.id)
        .single();
      if (error) return NextResponse.json({ error: 'Kit introuvable' }, { status: 404 });

      if (format === 'json') return NextResponse.json({ kit });
      if (format === 'csv') {
        const rows = (kit.materiel_kit_items ?? []).map((i: { name?: string | null; category?: string | null; weight_g?: number | null; quantity?: number | null }) =>
          [i.name ?? '', i.category ?? '', i.weight_g ?? 0, i.quantity ?? 1].join(',')
        );
        const csv = ['Nom,Catégorie,Poids(g),Qté', ...rows].join('\n');
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="kit-${kit.id}.csv"`,
          },
        });
      }
    }

    return NextResponse.json({ error: 'Format non encore implémenté' }, { status: 501 });
  } catch (err) {
    console.error('POST /api/materiel/export', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
