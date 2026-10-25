import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Récupérer le carnet
    const { data: carnet, error: carnetError } = await supabase
      .from('carnets')
      .select('id, title, description, destination, cover_image, visibility, created_at')
      .eq('id', id)
      .maybeSingle();

    if (carnetError || !carnet) {
      return NextResponse.json({ error: 'Carnet introuvable' }, { status: 404 });
    }

    // Récupérer les moments (manuels + auto)
    const { data: moments } = await supabase
      .from('carnet_moments')
      .select('id, citation, heure, lieu, image_url, moment_timestamp, source, hike_session_id, jour_numero, created_at')
      .eq('carnet_id', id)
      .order('moment_timestamp', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    return NextResponse.json({
      carnet,
      moments: moments || [],
    });
  } catch (err) {
    console.error('[GET /api/carnets/[id]]', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
