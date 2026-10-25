import { inventoryErrorStatus } from '@/features/materiel/domain/apiErrors';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { productOwnershipPatchSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/materiel/items/:id — met à jour un objet d'inventaire. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const parsed = productOwnershipPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('patch_inventory_item', {p_id:id,p_patch:parsed.data});
    if (error) return NextResponse.json({error:error.message},{status:inventoryErrorStatus(error)});

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('PATCH /api/materiel/items/:id', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: err instanceof SyntaxError ? 400 : 500 }
    );
  }
}

/** DELETE /api/materiel/items/:id — supprime un objet d'inventaire. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const { data, error } = await supabase
      .from('product_ownership')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({error:error.message},{status:inventoryErrorStatus(error)});
    if (!data) return NextResponse.json({error:'Objet introuvable'},{status:404});

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error('DELETE /api/materiel/items/:id', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: err instanceof SyntaxError ? 400 : 500 }
    );
  }
}
