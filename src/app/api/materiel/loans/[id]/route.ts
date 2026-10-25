import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const StatusSchema = z.object({
  status: z.enum(['en_cours', 'rendu', 'en_retard', 'litige']),
  returned_at: z.string().nullable().optional(),
});

/** PATCH /api/materiel/loans/:id — met à jour le statut d'un prêt (prêteur ou emprunteur). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
    const parsed = StatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const patch: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.status === 'rendu') patch.returned_at = parsed.data.returned_at ?? new Date().toISOString();

    const { data, error } = await supabase
      .from('materiel_loans')
      .update(patch)
      .eq('id', id)
      .or(`lender_id.eq.${user.id},borrower_id.eq.${user.id}`)
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json({ loan: data });
  } catch (err) {
    console.error('PATCH /api/materiel/loans/:id', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
