import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log("MAP API START");

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    // ── Query real trails from Supabase — NO FILTERS ──────────────────────
    const { data, error } = await supabase
      .from('trails')
      .select(`
        id,
        name,
        activity_type,
        difficulty,
        geojson,
        source
      `)
      .limit(limit);

    console.log("SUPABASE ERROR :", error);
    console.log("TRAILS SUPABASE COUNT :", data?.length);
    console.log("FIRST TRAIL :", data?.[0]);

    if (error) {
      console.error("SUPABASE QUERY ERROR:", error);
      return NextResponse.json(
        {
          trails: [],
          outdoor_points: [],
          meta: { trails_count: 0, error: error.message },
        },
        { status: 500 }
      );
    }

    // Filter and normalize: only keep trails with valid GeoJSON LineString
    const trails = (data || [])
      .filter((row) => {
        const geojson = row.geojson as { type?: string; coordinates?: number[][] } | null;
        return (
          geojson !== null &&
          geojson !== undefined &&
          geojson.type === 'LineString' &&
          Array.isArray(geojson.coordinates) &&
          geojson.coordinates.length >= 2
        );
      })
      .map(normalizeTrail);

    console.log("VALID TRAILS AFTER FILTER:", trails.length);

    return NextResponse.json({
      trails,
      outdoor_points: [],
      meta: {
        trails_count: trails.length,
        total_count: data?.length ?? 0,
        source: 'supabase',
        pois_count: 0,
      },
    });
  } catch (err) {
    console.error("MAP API EXCEPTION:", err);
    return NextResponse.json(
      {
        trails: [],
        outdoor_points: [],
        meta: {
          trails_count: 0,
          source: 'error',
          pois_count: 0,
        },
      },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTrail(row: Record<string, any>) {
  const activityType = row.activity_type || 'hiking';
  const geojson = row.geojson as { type?: string; coordinates?: number[][] } | null;

  return {
    id: row.id,
    name: row.name || 'Sentier sans nom',
    trail_type: activityType,
    activity_type: activityType,
    difficulty: row.difficulty || 'moderate',
    geojson: geojson,
    source: row.source || 'openstreetmap',
    distance_km: null,
    elevation_gain: null,
    altitude_max: null,
    duration_hours: null,
    country: null,
    region: null,
    start_lat: geojson?.coordinates?.[0]?.[1] ?? null,
    start_lng: geojson?.coordinates?.[0]?.[0] ?? null,
    end_lat: geojson?.coordinates?.at(-1)?.[1] ?? null,
    end_lng: geojson?.coordinates?.at(-1)?.[0] ?? null,
    is_loop: false,
    description: null,
    surface: null,
    gps_points_count: geojson?.coordinates?.length ?? 0,
  };
}
