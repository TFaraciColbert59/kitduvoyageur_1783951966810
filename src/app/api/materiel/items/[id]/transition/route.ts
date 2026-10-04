import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { inventoryTransitionSchema } from '@/lib/schemas/materiel';
import { inventoryErrorStatus } from '@/features/materiel/domain/apiErrors';
export const runtime = 'nodejs';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const parsed = inventoryTransitionSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: 'Transition invalide' }, { status: 400 });
    const { id } = await params;
    const { data, error } = await supabase.rpc('transition_inventory_item', {
      p_id: id,
      p_status: parsed.data.status,
      p_expected_status: parsed.data.expected_status,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: inventoryErrorStatus(error) });
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Requête invalide' },
      { status: error instanceof SyntaxError ? 400 : 500 }
    );
  }
}
