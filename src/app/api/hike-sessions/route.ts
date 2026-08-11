import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PoiEvent {
  poiName: string;
  reachedAt: string;
  lat: number;
  lon: number;
}

interface SaveHikeSessionBody {
  routeId?: string | null;
  carnetId?: string | null;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  durationSeconds: number;
  elevationGainM?: number | null;
  positions: { latitude: number; longitude: number; altitude?: number }[];
  poiEvents: PoiEvent[];
}

/**
 * POST /api/hike-sessions
 * Sauvegarde une session de randonnée terminée et génère optionnellement
 * des carnet_moments automatiques si carnetId est fourni.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const guestSessionId = `guest-session-${Date.now()}`;
      const guestCarnetId = `guest-carnet-${Date.now()}`;
      return NextResponse.json({
        sessionId: guestSessionId,
        carnetId: guestCarnetId,
        isGuest: true,
      });
    }

    const userId = user.id;

    const body: SaveHikeSessionBody = await req.json();

    if (!body.startedAt || !body.endedAt || body.distanceKm == null || body.durationSeconds == null) {
      return NextResponse.json({ error: 'Données de session incomplètes' }, { status: 400 });
    }

    // Simplifier les positions : 1 point toutes les ~10 secondes max
    const simplified = simplifyPositions(body.positions, 10);
    const positionsGeojson = simplified.length > 1
      ? {
          type: 'LineString',
          coordinates: simplified.map((p) => [p.longitude, p.latitude]),
        }
      : null;

    // 1. Check idempotency (prevent duplicate session creation)
    let query = supabase
      .from('hike_sessions')
      .select('id, carnet_id')
      .eq('started_at', body.startedAt);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: existingSession } = await query.maybeSingle();

    if (existingSession) {
      return NextResponse.json({
        sessionId: existingSession.id,
        carnetId: existingSession.carnet_id || null,
      });
    }

    // 2. Automatic Carnet Creation if carnetId is not provided
    let carnetId = body.carnetId || null;

    if (!carnetId) {
      let title = `Randonnée du ${new Date(body.startedAt).toLocaleDateString('fr-FR')}`;
      if (body.routeId) {
        const { data: rData } = await supabase
          .from('hiking_routes')
          .select('name')
          .eq('id', Number(body.routeId))
          .maybeSingle();
        if (rData?.name) title = rData.name;
      }

      const { data: newCarnet, error: carnetErr } = await supabase
        .from('carnets')
        .insert({
          title,
          description: `Carnet d'expédition outdoor récapitulant ${body.distanceKm.toFixed(1)} km en ${formatDuration(body.durationSeconds)}.`,
          destination: title,
          distance_km: body.distanceKm,
          elevation_m: body.elevationGainM ?? 0,
          duration: formatDuration(body.durationSeconds),
          author_id: userId,
          visibility: 'public',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!carnetErr && newCarnet) {
        carnetId = newCarnet.id;
      } else {
        console.warn('[hike-sessions] Automatic carnet creation notice:', carnetErr?.message);
      }
    }

    // 3. Insert the hike session
    const { data: session, error: sessionError } = await supabase
      .from('hike_sessions')
      .insert({
        user_id: userId,
        route_id: body.routeId ? Number(body.routeId) : null,
        carnet_id: carnetId,
        started_at: body.startedAt,
        ended_at: body.endedAt,
        distance_km: body.distanceKm,
        duration_seconds: body.durationSeconds,
        elevation_gain_m: body.elevationGainM ?? null,
        positions_geojson: positionsGeojson,
        poi_events: body.poiEvents || [],
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('[hike-sessions] Insert error:', sessionError);
      return NextResponse.json({ error: sessionError ? sessionError.message : 'Erreur lors de la sauvegarde de session' }, { status: 500 });
    }

    const sessionId = session.id;

    // 4. Generate auto moments for the carnet if carnetId exists
    if (carnetId) {
      await generateAutoMoments(supabase, {
        sessionId,
        carnetId,
        startedAt: body.startedAt,
        endedAt: body.endedAt,
        distanceKm: body.distanceKm,
        durationSeconds: body.durationSeconds,
        elevationGainM: body.elevationGainM,
        poiEvents: body.poiEvents || [],
        positions: simplified,
      });
    }

    return NextResponse.json({ sessionId, carnetId });
  } catch (err) {
    console.error('[hike-sessions] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}

/**
 * GET /api/hike-sessions?carnetId=X
 * Liste les sessions de randonnée de l'utilisateur connecté pour un carnet donné.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const carnetId = searchParams.get('carnetId');

    let query = supabase
      .from('hike_sessions')
      .select('id, route_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, poi_events, narratives, created_at')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });

    if (carnetId) {
      query = query.eq('carnet_id', carnetId);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[hike-sessions] GET error:', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Garde 1 point max par intervalle (secondes), sans supprimer le premier et dernier. */
function simplifyPositions(
  positions: { latitude: number; longitude: number; altitude?: number }[],
  intervalSeconds: number
): { latitude: number; longitude: number; altitude?: number }[] {
  if (positions.length <= 2) return positions;
  const result = [positions[0]];
  // On suppose positions est chronologique, ~1 entrée/seconde depuis le hook
  const step = Math.max(1, Math.round(intervalSeconds));
  for (let i = step; i < positions.length - 1; i += step) {
    result.push(positions[i]);
  }
  result.push(positions[positions.length - 1]);
  return result;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

/** Génère des carnet_moments auto depuis la session. */
async function generateAutoMoments(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  params: {
    sessionId: string;
    carnetId: string;
    startedAt: string;
    endedAt: string;
    distanceKm: number;
    durationSeconds: number;
    elevationGainM?: number | null;
    poiEvents: PoiEvent[];
    positions: { latitude: number; longitude: number; altitude?: number }[];
  }
) {
  const moments: object[] = [];

  // Moment Départ
  const startPos = params.positions[0];
  moments.push({
    carnet_id: params.carnetId,
    hike_session_id: params.sessionId,
    moment_timestamp: params.startedAt,
    source: 'auto',
    citation: '🥾 Départ de la randonnée',
    lieu: startPos
      ? `${startPos.latitude.toFixed(4)}, ${startPos.longitude.toFixed(4)}`
      : null,
    heure: new Date(params.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    jour_numero: 1,
  });

  // Moments POIs atteints
  for (const poi of params.poiEvents) {
    moments.push({
      carnet_id: params.carnetId,
      hike_session_id: params.sessionId,
      moment_timestamp: poi.reachedAt,
      source: 'auto',
      citation: `📍 ${poi.poiName}`,
      lieu: `${poi.lat.toFixed(4)}, ${poi.lon.toFixed(4)}`,
      heure: new Date(poi.reachedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      jour_numero: 1,
    });
  }

  // Moment Arrivée
  const endPos = params.positions[params.positions.length - 1];
  const summary = [
    `📏 ${params.distanceKm.toFixed(1)} km`,
    `⏱ ${formatDuration(params.durationSeconds)}`,
    params.elevationGainM ? `↑ ${Math.round(params.elevationGainM)} m D+` : null,
  ].filter(Boolean).join(' · ');

  moments.push({
    carnet_id: params.carnetId,
    hike_session_id: params.sessionId,
    moment_timestamp: params.endedAt,
    source: 'auto',
    citation: `🏁 Arrivée — ${summary}`,
    lieu: endPos
      ? `${endPos.latitude.toFixed(4)}, ${endPos.longitude.toFixed(4)}`
      : null,
    heure: new Date(params.endedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    jour_numero: 1,
  });

  // Insérer tous les moments
  if (moments.length > 0) {
    const { error } = await supabase.from('carnet_moments').insert(moments);
    if (error) {
      console.error('[hike-sessions] generateAutoMoments error:', error);
    }
  }
}
