import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const viewerId = authData?.user?.id ?? null;

    const { data: session, error } = await supabase
      .from('hike_sessions')
      // Jamais `*` : ni positions GPS, ni notes privées dans la réponse.
      .select(
        'id, user_id, route_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, max_altitude_m, title, visibility, processing_status, track_quality, weather, created_at'
      )
      .eq('id', id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    const { user_id: ownerId, ...safeSession } = session as Record<string, unknown> & {
      user_id?: string | null;
      weather?: unknown;
      visibility?: string | null;
    };
    const isOwner = Boolean(viewerId && ownerId && viewerId === ownerId);

    if (!isOwner) {
      /*
       * La météo stockée porte le point exact utilisé pour l'interroger, donc
       * souvent le vrai départ. Un visiteur n'en reçoit jamais les coordonnées,
       * et une session `private` ne lui en livre aucune donnée.
       */
      if (safeSession.visibility === 'private') {
        safeSession.weather = null;
      } else if (safeSession.weather && typeof safeSession.weather === 'object') {
        safeSession.weather = {
          ...(safeSession.weather as Record<string, unknown>),
          latitude: null,
          longitude: null,
        };
      }
    }

    // `notes` n'est jamais sélectionné ; ceinture et bretelles si la colonne
    // revenait un jour dans le select.
    delete safeSession.notes;

    return NextResponse.json({ session: safeSession });
  } catch (err) {
    console.error('[hike-sessions] exception', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
