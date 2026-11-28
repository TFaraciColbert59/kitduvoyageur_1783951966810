import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DeleteQuerySchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Lot 09 — RGPD Article 17 (Droit à l'effacement) :
 * Purge complète d'une session d'activité (activity_sessions, hike_sessions,
 * live_beacons, gear_usage_ledger) appartenant à l'utilisateur authentifié.
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = DeleteQuerySchema.safeParse({
      sessionId: url.searchParams.get('sessionId'),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid sessionId UUID' }, { status: 400 });
    }

    const { sessionId } = parsed.data;

    // Purge en cascade bornée à `user_id` (RLS + filtre explicite)
    await supabase
      .from('live_beacons')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

    await supabase
      .from('gear_usage_ledger')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

    await supabase
      .from('hike_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    const { error: delErr } = await supabase
      .from('activity_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, purgedSessionId: sessionId, rgpdArt17: true },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    console.error('[explorer/v2/activity DELETE] unexpected error', err);
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}
