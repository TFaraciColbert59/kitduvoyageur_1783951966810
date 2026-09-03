import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { decideKitFork } from '@/features/kits/lineage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ForkSchema = z.object({
  kit_id: z.string().uuid(),
  /** Nom libre pour le fork ; sans valeur, un nom d'adaptation est proposé. */
  name: z.string().min(1, 'Le nom est requis').max(120).optional(),
});

interface SourceItem {
  product_ownership_id: string | null;
  product_id: string | null;
  name: string | null;
  category: string | null;
  weight_g: number | null;
  quantity: number;
  is_checked: boolean;
}

/**
 * POST /api/materiel/fork — duplique un kit (public ou propre) en acte de FILIATION.
 *
 * - Fork du kit d'autrui  → filiation réelle (forked_from, origin='fork').
 * - Auto-fork (son kit)   → duplication privée (origine manuelle, PAS de filiation) :
 *   un auto-fork ne compte jamais dans la conservation ni n'ouvre droit à commission.
 * - Le lien catalogue (product_id) est reproduit sur chaque article de la lignée.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const parsed = ForkSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Kit invalide' }, { status: 400 });

    const { data: source, error } = await supabase
      .from('materiel_kits')
      .select('*, materiel_kit_items(*)')
      .eq('id', parsed.data.kit_id)
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .maybeSingle();
    if (error || !source) return NextResponse.json({ error: 'Kit introuvable' }, { status: 404 });

    // Identité du créateur source (nom d'adaptation, uniquement pour le libellé)
    const { data: ownerRow } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', source.user_id)
      .maybeSingle();

    const decision = decideKitFork({
      sourceId: source.id,
      sourceUserId: source.user_id,
      sourceName: source.name ?? 'Kit sans nom',
      currentUserId: user.id,
      sourceOwnerName: ownerRow?.full_name ?? null,
      requestedName: parsed.data.name ?? null,
    });

    const { data: newKit, error: kitError } = await supabase
      .from('materiel_kits')
      .insert({
        user_id: user.id,
        name: decision.name,
        description: source.description,
        season: source.season,
        total_weight_g: source.total_weight_g,
        is_public: false,
        tags: source.tags,
        forked_from: decision.forkedFrom,
        origin: decision.origin,
      })
      .select('*')
      .single();
    if (kitError) throw kitError;

    const items = (source.materiel_kit_items ?? []) as SourceItem[];
    if (items.length > 0) {
      const rows = items.map((i) => ({
        kit_id: newKit.id,
        user_id: user.id,
        product_ownership_id: i.product_ownership_id ?? null,
        product_id: i.product_id ?? null,
        name: i.name ?? 'Article',
        category: i.category ?? 'Autre',
        weight_g: i.weight_g ?? 0,
        quantity: i.quantity ?? 1,
        is_checked: false,
      }));
      const { error: itemsError } = await supabase.from('materiel_kit_items').insert(rows);
      if (itemsError) throw itemsError;
    }

    // Journal d'audit conservé (source désormais bordée par la colonne forked_from)
    await supabase.from('materiel_kit_history').insert({
      kit_id: newKit.id,
      user_id: user.id,
      action: 'forked',
      payload: { source_kit_id: source.id, origin: decision.origin },
    });

    return NextResponse.json({ kit: newKit }, { status: 201 });
  } catch (err) {
    console.error('POST /api/materiel/fork', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}