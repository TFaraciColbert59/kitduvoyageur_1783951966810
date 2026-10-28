import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: session, error } = await supabase
      .from('hike_sessions')
      // Jamais `*` : positions GPS horodatées et narratives internes exclues.
      .select(
        'id, route_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, max_altitude_m, title, visibility, processing_status, track_quality, weather, created_at'
      )
      .eq('id', id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (err) {
    console.error('[hike-sessions] exception', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
