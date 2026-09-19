import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { awardChecklistCompleted } from '@/features/progression/server/producerHooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/trips/[id]/checklist/complete
 *
 * Appelée après un toggle réussi de la checklist (le toggle reste une écriture
 * directe client). Le serveur vérifie l'état réel en base via l'accroche
 * (voyage `planned`/`active`, 100 % des items cochés) puis attribue une seule
 * fois par voyage. Une checklist incomplète ne crédite rien et ne bloque pas.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    // Autorisation : propriétaire ou collaborateur éditeur du voyage.
    const { data: trip } = await supabase
      .from('trips')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (!trip) return NextResponse.json({ error: 'Voyage introuvable' }, { status: 404 });

    if (trip.user_id !== user.id) {
      const { data: collaborator } = await supabase
        .from('trip_collaborators')
        .select('role')
        .eq('trip_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (collaborator?.role !== 'editor') {
        return NextResponse.json({ error: 'Voyage non autorisé' }, { status: 403 });
      }
    }

    const result = await awardChecklistCompleted(id);
    return NextResponse.json(
      { ok: true, awarded: result.success, outcome: result.outcome, reason: result.reason ?? null },
      { status: 200 }
    );
  } catch (err) {
    console.error('POST /api/trips/[id]/checklist/complete', err);
    return NextResponse.json({ ok: true, awarded: false }, { status: 200 });
  }
}
