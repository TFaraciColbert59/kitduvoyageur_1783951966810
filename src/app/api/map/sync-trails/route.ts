import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

// ── Available zones (mirrors Edge Function) ───────────────────
const SYNC_ZONES: Record<string, { label: string; country: string }> = {
  chamonix: { label: 'Chamonix / Mont-Blanc', country: 'France' },
  alpes_nord: { label: 'Alpes du Nord', country: 'France' },
  alpes_sud: { label: 'Alpes du Sud', country: 'France' },
  mercantour: { label: 'Mercantour', country: 'France' },
  pyrenees: { label: 'Pyrénées centrales', country: 'France' },
  vercors: { label: 'Vercors', country: 'France' },
  belledonne: { label: 'Belledonne', country: 'France' },
  ecrins: { label: 'Écrins', country: 'France' },
  corsica: { label: 'Corse (GR20)', country: 'France' },
  jura: { label: 'Jura', country: 'France' },
};

/**
 * POST /api/map/sync-trails
 *
 * Delegates to the Supabase Edge Function `fetch-osm-trails` which runs
 * server-side (no sandbox restrictions) and calls Overpass API directly.
 * Results are upserted into public.hiking_trails by osm_id.
 *
 * Body: { zone?: string, bbox?: BBox, country?: string, label?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    // Call the Edge Function — it runs outside the sandbox and can reach Overpass
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fetch-osm-trails`;

    console.log(`[sync-trails] Delegating to Edge Function: ${edgeFunctionUrl}`);
    console.log(`[sync-trails] Request body:`, JSON.stringify(body));

    const edgeRes = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });

    const result = await edgeRes.json();

    if (!edgeRes.ok) {
      console.error('[sync-trails] Edge Function error:', result);
      return NextResponse.json(
        {
          success: false,
          error: result.error || `Edge Function returned HTTP ${edgeRes.status}`,
          hint: result.hint || 'Check Supabase Edge Function logs for details.',
        },
        { status: edgeRes.status }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[sync-trails] Fatal error:', err);
    return NextResponse.json(
      {
        success: false,
        error: String(err),
        hint: 'Failed to reach Supabase Edge Function. Ensure it is deployed.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/map/sync-trails
 * Returns available zones and current hiking_trails count from Supabase.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { count: totalCount } = await supabase
      .from('hiking_trails')
      .select('id', { count: 'exact', head: true });

    const { count: osmCount } = await supabase
      .from('hiking_trails')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'overpass');

    const { data: sample } = await supabase
      .from('hiking_trails')
      .select('name, gps_points_count, distance_km, difficulty, region, geojson')
      .eq('source', 'overpass')
      .not('geojson', 'is', null)
      .limit(5);

    return NextResponse.json({
      hiking_trails_total: totalCount ?? 0,
      hiking_trails_from_osm: osmCount ?? 0,
      available_zones: Object.entries(SYNC_ZONES).map(([key, z]) => ({
        key,
        label: z.label,
        country: z.country,
      })),
      sample_trails: sample?.map((t) => ({
        name: t.name,
        gps_points: t.gps_points_count,
        distance_km: t.distance_km,
        difficulty: t.difficulty,
        region: t.region,
        has_geojson: !!t.geojson,
        geojson_type: (t.geojson as { type?: string } | null)?.type,
        coordinates_count: (t.geojson as { coordinates?: unknown[] } | null)?.coordinates?.length ?? 0,
      })) ?? [],
      instructions:
        'POST with { "zone": "chamonix" } to import trails via Edge Function. ' +
        'Available zones: ' + Object.keys(SYNC_ZONES).join(', '),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
