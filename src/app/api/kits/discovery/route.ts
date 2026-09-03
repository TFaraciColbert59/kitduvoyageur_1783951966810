import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/kits/discovery
 * Découverte des lignées (Lot 7) + encart produit (Lot 5).
 *   ?productId=uuuid  → encart « présent dans N lignées, gardé par X sur 10 »
 *   (sans filtre)    → deux entrées : « ce qui revient du terrain » (items à
 *                     forte conservation) et « lignées endurantes » (kits
 *                     emportés et stables), lecture des matviews (2 axes
 *                     distincts, plancher de crédibilité appliqué).
 * Lecture publique des agrégats uniquement — jamais de données personnelles,
 * jamais de positions GPS.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const productId = req.nextUrl.searchParams.get('productId');

    // ── Encart produit : présence dans les lignées + conservation ──
    if (productId) {
      const [{ data: survival }, { data: lineages }] = await Promise.all([
        supabase
          .from('kit_item_survival')
          .select('item_key, kept_count, dropped_count')
          .eq('item_key', productId)
          .maybeSingle(),
        supabase
          .from('materiel_kit_items')
          .select('materiel_kits!inner(lineage_root_id)')
          .eq('product_id', productId)
          .limit(500),
      ]);

      const rootIds = new Set<string>();
      for (const row of (lineages ?? []) as { materiel_kits: { lineage_root_id: string } | { lineage_root_id: string }[] }[]) {
        const k = row.materiel_kits;
        const id = Array.isArray(k) ? k[0]?.lineage_root_id : k?.lineage_root_id;
        if (id) rootIds.add(id);
      }

      const kept = survival?.kept_count ?? 0;
      const dropped = survival?.dropped_count ?? 0;

      return NextResponse.json({
        product_id: productId,
        lineages_count: rootIds.size,
        /** Racine de la lignée du produit — cible du KitSheet (encart produit). */
        lineage_root_id: rootIds.values().next().value ?? null,
        kept_count: kept,
        dropped_count: dropped,
      });
    }

    // ── Découverte : items conservés + lignées endurantes (seuils) ──
    // Filtres optionnels : region (massif) / season (printemps/ete/automne/hiver)
    const region = req.nextUrl.searchParams.get('region');
    const season = req.nextUrl.searchParams.get('season');
    const seasonMonths: Record<string, number[]> = {
      printemps: [3, 4, 5],
      ete: [6, 7, 8],
      automne: [9, 10, 11],
      hiver: [12, 1, 2],
    };
    const months = (season && seasonMonths[season]) || null;

    // Kit ids des sessions correspondant aux filtres
    const kitIdSet = new Set<string>();
    if (region || months) {
      const { data: sessions } = await supabase
        .from('hike_sessions')
        .select('kit_id, started_at, route_id')
        .not('kit_id', 'is', null)
        .limit(2000);

      const regionRouteIds = new Set<string>();
      if (region) {
        const { data: routeRows } = await supabase
          .from('hiking_routes')
          .select('id')
          .eq('region', region)
          .limit(2000);
        for (const r of (routeRows ?? []) as { id: number | string }[]) regionRouteIds.add(String(r.id));
      }

      for (const s of (sessions ?? []) as {
        kit_id: string;
        started_at: string;
        route_id: number | string | null;
      }[]) {
        if (region && (s.route_id == null || !regionRouteIds.has(String(s.route_id)))) continue;
        if (months) {
          const m = new Date(s.started_at).getMonth() + 1; // 1-12
          if (!months.includes(m)) continue;
        }
        kitIdSet.add(s.kit_id);
      }
    }

    const [{ data: items }, { data: lineagesRaw }, { data: kitNames }] = await Promise.all([
      supabase
        .from('kit_item_survival')
        .select('item_key, product_id, kept_count, dropped_count')
        .order('kept_count', { ascending: false })
        .limit(50),
      supabase
        .from('kit_trust_scores')
        .select('kit_id, propagation_score, endurance_score, sessions_count, has_min_sessions')
        .eq('has_min_sessions', true)
        .order('endurance_score', { ascending: false })
        .limit(200),
      supabase.from('materiel_kits').select('id, name').limit(500),
    ]);

    const nameById = new Map<string, string>(
      (((kitNames ?? null) as { id: string; name: string }[] | null) ?? []).map((k) => [k.id, k.name])
    );

    let lineages = (lineagesRaw ?? []) as {
      kit_id: string;
      propagation_score: number;
      endurance_score: number;
      sessions_count: number;
    }[];

    if (kitIdSet.size > 0) {
      // Ne garder que les lignées dont un kit a une session filtrée
      const { data: roots } = await supabase
        .from('materiel_kits')
        .select('id, lineage_root_id')
        .in('id', [...kitIdSet]);
      const rootOf = new Set<string>();
      for (const r of (roots ?? []) as { id: string; lineage_root_id: string | null }[]) {
        rootOf.add(r.lineage_root_id ?? r.id);
      }
      lineages = lineages.filter((l) => rootOf.has(l.kit_id));
    }

    return NextResponse.json({
      items: (items ?? []).map((i) => ({
        item_key: i.item_key,
        product_id: i.product_id,
        kept_count: i.kept_count,
        dropped_count: i.dropped_count,
      })),
      lineages: lineages.slice(0, 50).map((l) => ({
        kit_id: l.kit_id,
        kit_name: nameById.get(l.kit_id) ?? 'Lignée',
        propagation_score: l.propagation_score,
        endurance_score: l.endurance_score,
        sessions_count: l.sessions_count,
      })),
    });
  } catch (err) {
    console.error('GET /api/kits/discovery', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}