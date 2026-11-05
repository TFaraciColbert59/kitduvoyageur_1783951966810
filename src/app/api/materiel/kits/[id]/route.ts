import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { materielKitSchema } from '@/lib/schemas/materiel';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/materiel/kits/:id — mettre à jour un kit (remplace ses articles atomiquement). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const patchSchema = materielKitSchema.partial().extend({
      allowEmptyItems: z.boolean().optional(),
    });

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      );
    }

    const { items, allowEmptyItems = false, ...patch } = parsed.data;

    // 1. Traitement des articles via RPC atomique si le champ items est fourni
    if (items !== undefined) {
      if (items.length === 0 && !allowEmptyItems) {
        return NextResponse.json(
          { error: 'Vidage non intentionnel refusé. Passer allowEmptyItems: true pour confirmer le vidage.' },
          { status: 409 }
        );
      }

      const { error: rpcError } = await supabase.rpc('replace_kit_items', {
        p_kit_id: id,
        p_items: items,
        p_allow_empty: allowEmptyItems,
      });

      if (rpcError) {
        if (rpcError.code === '23514') {
          return NextResponse.json({ error: rpcError.message }, { status: 409 });
        }
        if (rpcError.code === '42501') {
          return NextResponse.json({ error: 'Kit introuvable ou non autorisé' }, { status: 403 });
        }
        if (rpcError.code === '28000') {
          return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }
        throw rpcError;
      }
    }

    // 2. Mise à jour des attributs du kit si présents
    let updatedKit = null;
    if (Object.keys(patch).length > 0) {
      const { data, error } = await supabase
        .from('materiel_kits')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) throw error;
      updatedKit = data;

      await supabase.from('materiel_kit_history').insert({
        kit_id: id,
        user_id: user.id,
        action: 'updated',
        payload: patch,
      });
    } else {
      const { data, error } = await supabase
        .from('materiel_kits')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      updatedKit = data;
    }

    return NextResponse.json({ kit: updatedKit });
  } catch (err) {
    console.error('PATCH /api/materiel/kits/:id', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/** DELETE /api/materiel/kits/:id — suppression définitive d'un kit. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const { error } = await supabase
      .from('materiel_kits')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error('DELETE /api/materiel/kits/:id', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
