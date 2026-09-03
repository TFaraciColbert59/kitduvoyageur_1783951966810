import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/kits/[id]/sheet
 * Assemble la fiche d'un kit (KitSheet, Lot 5) — l'objet circule, il n'a pas
 * de page propre.
 *   • kit        : materiel_kits (RLS own-or-public) + nom parent/racine
 *   • journal    : RPC get_kit_journal (agrégats ANONYMISÉS — RGPD)
 *   • trust      : kit_trust_scores (endurance/propagation, plancher)
 *   • survival   : kit_item_survival_by_kit (conservation par item)
 * Les détails per-kit (matviews) ne sont chargés que pour un utilisateur
 * connecté : les matviews ne sont pas ouvertes à l'anonyme.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: kit, error } = await supabase
      .from('materiel_kits')
      .select(
        'id, user_id, name, description, total_weight_g, is_public, is_souche, ' +
          'origin, generation, forked_from, field_proven_count, cover_image_url, tags, created_at'
      )
      .eq('id', params.id)
      .maybeSingle();
    if (error || !kit) return NextResponse.json({ error: 'Kit introuvable' }, { status: 404 });

    const kitRow = kit as unknown as {
      forked_from: string | null;
    } & Record<string, unknown>;

    // Noms du parent direct et de la racine — pour lire la lignée (jamais les noms de forks).
    const parentName = kitRow.forked_from
      ? ((await supabase.from('materiel_kits').select('name').eq('id', kitRow.forked_from).maybeSingle())
          .data as { name: string } | null)?.name ?? null
      : null;

    const { data: journal } = await supabase.rpc('get_kit_journal', { p_kit_id: params.id });

    let trust: Record<string, unknown> | null = null;
    let survival: Record<string, unknown>[] | null = null;

    if (user) {
      const [t, s] = await Promise.all([
        supabase.from('kit_trust_scores').select('*').eq('kit_id', params.id).maybeSingle(),
        supabase.from('kit_item_survival_by_kit').select('*').eq('kit_id', params.id),
      ]);
      trust = (t.data as Record<string, unknown> | null) ?? null;
      survival = (s.data as Record<string, unknown>[] | null) ?? [];
    }

    return NextResponse.json({
      kit: { ...kitRow, parent_name: parentName },
      journal,
      trust,
      survival: survival ?? [],
    });
  } catch (err) {
    console.error('GET /api/kits/[id]/sheet', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}