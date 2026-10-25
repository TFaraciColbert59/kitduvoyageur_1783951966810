import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supportResponseSchema } from '@/features/support/validation';
import { inventoryErrorStatus } from '@/features/materiel/domain/apiErrors';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { id } = await params;
    const parsed = supportResponseSchema.safeParse(await req.json());
    if (!z.string().uuid().safeParse(id).success || !parsed.success)
      return NextResponse.json({ error: 'Réponse invalide' }, { status: 400 });
    const { data, error } = await db.rpc('respond_support_ticket', {
      p_id: id,
      p_status: parsed.data.status,
      p_response: parsed.data.response,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: inventoryErrorStatus(error) });
    return NextResponse.json({ ticket: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Réponse impossible' },
      { status: error instanceof SyntaxError ? 400 : 500 }
    );
  }
}
