import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

/**
 * GET /api/hikes/[id]
 *
 * Retourne les détails complets d'une randonnée avec son tracé GPS GeoJSON RÉEL
 * issu de hiking_routes.geom via ST_AsGeoJSON.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: 'Identifiant de randonnée invalide' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // 1. Récupération du GeoJSON réel via la fonction Postgres get_route_geojson
    const { data: geojsonData, error: geojsonError } = await supabase
      .rpc('get_route_geojson', { p_route_id: numericId });

    // 2. Récupération des métadonnées de base et calculées
    const [routeRes, metaRes, scoreRes] = await Promise.all([
      supabase.from('hiking_routes').select('id, name, ref, network, distance_km').eq('id', numericId).maybeSingle(),
      supabase.from('trail_metadata').select('difficulty, duration_hours, elevation_gain, elevation_loss, terrain_type, family_friendly, season, ai_description').eq('trail_id', numericId).maybeSingle(),
      supabase.from('trail_scores').select('adventure_score, nature_score, panorama_score').eq('trail_id', numericId).maybeSingle(),
    ]);

    if (routeRes.error || !routeRes.data) {
      return NextResponse.json({ error: 'Randonnée introuvable' }, { status: 404 });
    }

    const route = routeRes.data;
    const meta = metaRes.data;
    const scores = scoreRes.data;

    let geojson = geojsonData || null;
    if (typeof geojson === 'string') {
      try {
        geojson = JSON.parse(geojson);
      } catch {
        // keep as is or null
      }
    }

    const result = {
      id: String(route.id),
      name: route.name || 'Randonnée sans titre',
      ref: route.ref || null,
      network: route.network || null,
      distance_km: route.distance_km != null ? Number(route.distance_km) : null,
      difficulty: meta?.difficulty || null,
      duration_hours: meta?.duration_hours != null ? Number(meta.duration_hours) : null,
      elevation_gain: meta?.elevation_gain != null ? Number(meta.elevation_gain) : null,
      elevation_loss: meta?.elevation_loss != null ? Number(meta.elevation_loss) : null,
      terrain_type: meta?.terrain_type || null,
      family_friendly: meta?.family_friendly || false,
      season: meta?.season || null,
      ai_description: meta?.ai_description || null,
      adventure_score: scores?.adventure_score != null ? Number(scores.adventure_score) : null,
      nature_score: scores?.nature_score != null ? Number(scores.nature_score) : null,
      panorama_score: scores?.panorama_score != null ? Number(scores.panorama_score) : null,
      geojson,
    };

    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return response;
  } catch (error: any) {
    console.error(`API /api/hikes/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
