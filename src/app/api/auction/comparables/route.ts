import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const produit_id = searchParams.get('produit_id');
    const prix_depart_cents = searchParams.get('prix_depart_cents');

    if (!produit_id) {
      return NextResponse.json({ error: 'produit_id_requis' }, { status: 400 });
    }

    const { data: comparables, error } = await supabase.rpc('get_comparable_sales', {
      p_produit_id: produit_id,
      p_limit: 5,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sales: { montant_cents: number; closed_at: string; nombre_encherisseurs: number }[] = comparables ?? [];

    if (sales.length === 0) {
      return NextResponse.json({ comparables: [], suggestion: null, alerte: null });
    }

    const amounts = sales.map((s) => s.montant_cents);
    const avg = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

    let alerte: string | null = null;
    if (prix_depart_cents) {
      const depart = parseInt(prix_depart_cents, 10);
      if (depart > avg * 1.4) {
        alerte = `Votre prix de départ (${(depart / 100).toFixed(0)} €) est significativement au-dessus de la moyenne des ventes comparables (${(avg / 100).toFixed(0)} €). Cela pourrait décourager les enchérisseurs.`;
      } else if (depart < avg * 0.5) {
        alerte = `Votre prix de départ (${(depart / 100).toFixed(0)} €) est très en dessous de la moyenne des ventes comparables (${(avg / 100).toFixed(0)} €). Vous risquez de sous-évaluer votre article.`;
      }
    }

    return NextResponse.json({
      comparables: sales,
      suggestion: {
        moyenne_cents: avg,
        min_cents: min,
        max_cents: max,
        nb_ventes: sales.length,
      },
      alerte,
    });
  } catch (err) {
    console.error('[auction/comparables] error:', err);
    return NextResponse.json({ error: 'erreur_serveur' }, { status: 500 });
  }
}
