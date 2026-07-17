import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

/**
 * POST /api/map/seed-trails
 *
 * Seeds Supabase hiking_trails with real GPS data from OpenStreetMap
 * by calling the Supabase Edge Function for one or multiple zones.
 *
 * Body options:
 *   { zone: "chamonix" }                    — single zone
 *   { zones: ["chamonix", "vercors"] }      — multiple zones (sequential)
 *   { zone: "all" }                          — all predefined zones
 */

const ALL_ZONES = [
  'chamonix',
  'vercors',
  'belledonne',
  'mercantour',
  'pyrenees',
  'alpes_sud',
  'ecrins',
  'jura',
  'corsica',
  'alpes_nord',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fetch-osm-trails`;

    // Determine which zones to process
    let zonesToProcess: string[];
    if (body.zone === 'all') {
      zonesToProcess = ALL_ZONES;
    } else if (Array.isArray(body.zones)) {
      zonesToProcess = body.zones;
    } else if (body.zone) {
      zonesToProcess = [body.zone];
    } else {
      // Default: start with Chamonix (small, reliable zone)
      zonesToProcess = ['chamonix'];
    }

    console.log(`[seed-trails] Processing ${zonesToProcess.length} zone(s): ${zonesToProcess.join(', ')}`);

    const results: Array<{
      zone: string;
      success: boolean;
      trails_inserted?: number;
      error?: string;
      stats?: Record<string, number>;
    }> = [];

    let totalInserted = 0;

    for (const zone of zonesToProcess) {
      try {
        console.log(`[seed-trails] Fetching zone: ${zone}`);

        const res = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ zone }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          const inserted = data.trails_inserted ?? 0;
          totalInserted += inserted;
          results.push({
            zone,
            success: true,
            trails_inserted: inserted,
            stats: data.stats,
          });
          console.log(`[seed-trails] ✅ ${zone}: ${inserted} trails inserted`);
        } else {
          results.push({
            zone,
            success: false,
            error: data.error || `HTTP ${res.status}`,
          });
          console.warn(`[seed-trails] ⚠️ ${zone}: ${data.error || 'failed'}`);
        }

        // Small delay between zones to be respectful to Overpass API
        if (zonesToProcess.length > 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (zoneErr) {
        results.push({
          zone,
          success: false,
          error: String(zoneErr),
        });
        console.error(`[seed-trails] ❌ ${zone}:`, zoneErr);
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      zones_processed: zonesToProcess.length,
      zones_succeeded: successCount,
      zones_failed: zonesToProcess.length - successCount,
      total_trails_inserted: totalInserted,
      results,
      message:
        totalInserted > 0
          ? `✅ ${totalInserted} sentiers GPS réels importés depuis OpenStreetMap (${successCount}/${zonesToProcess.length} zones)`
          : `⚠️ Aucun sentier importé. Vérifiez les logs de l'Edge Function.`,
    });
  } catch (err) {
    console.error('[seed-trails] Fatal error:', err);
    return NextResponse.json(
      {
        success: false,
        error: String(err),
        hint: 'Ensure the Supabase Edge Function fetch-osm-trails is deployed.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/map/seed-trails
 * Returns available zones for seeding.
 */
export async function GET() {
  return NextResponse.json({
    available_zones: ALL_ZONES,
    usage: {
      single_zone: 'POST { "zone": "chamonix" }',
      multiple_zones: 'POST { "zones": ["chamonix", "vercors", "pyrenees"] }',
      all_zones: 'POST { "zone": "all" }',
    },
    note: 'Each zone takes ~30-60s. Use single zones to avoid timeout.',
  });
}
