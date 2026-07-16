import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchHikingTrails,
  fetchRefuges,
  fetchWaterPoints,
  fetchNaturalFeatures,
  fetchCamping,
  transformTrailElement,
  transformPOIElement,
  getTilesForBBox,
  WORLD_REGIONS,
  type BBox,
} from '@/lib/overpass';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));

    const regionName = body.region as string | undefined;
    const bboxParam = body.bbox as BBox | undefined;
    const syncType = body.type as string || 'all';

    // Determine bbox
    let bbox: BBox;
    let country = 'Unknown';
    let region = 'Unknown';

    if (bboxParam) {
      bbox = bboxParam;
      region = body.regionName || 'Custom';
      country = body.country || 'Unknown';
    } else if (regionName) {
      const found = WORLD_REGIONS.find(r => r.name === regionName);
      if (!found) {
        return NextResponse.json({ error: 'Region not found' }, { status: 404 });
      }
      bbox = found.bbox;
      country = found.country;
      region = found.name;
    } else {
      // Default: French Alps
      const defaultRegion = WORLD_REGIONS[0];
      bbox = defaultRegion.bbox;
      country = defaultRegion.country;
      region = defaultRegion.name;
    }

    // Check if recently synced (cache: 24h)
    const { data: recentSync } = await supabase
      .from('overpass_sync_log')
      .select('completed_at')
      .eq('region', region)
      .eq('status', 'success')
      .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .single();

    if (recentSync) {
      return NextResponse.json({
        cached: true,
        message: `Region "${region}" already synced recently`,
        last_sync: recentSync.completed_at,
      });
    }

    // Log sync start
    const { data: syncLog } = await supabase
      .from('overpass_sync_log')
      .insert({
        sync_type: syncType,
        bbox: JSON.stringify(bbox),
        country,
        region,
        status: 'running',
      })
      .select()
      .single();

    const syncId = syncLog?.id;
    let totalInserted = 0;
    let totalFetched = 0;

    try {
      // Fetch trails — AllTrails methodology: process per 2×2 degree tile
      if (syncType === 'all' || syncType === 'trails') {
        // Split bbox into AllTrails-style 2×2 degree tiles
        const tiles = getTilesForBBox(bbox);
        const tilesToProcess = tiles.slice(0, 4); // max 4 tiles per sync to avoid timeout

        for (const tile of tilesToProcess) {
          const trailElements = await fetchHikingTrails(tile, 50);
          totalFetched += trailElements.length;

          const trailsToInsert = trailElements
            .filter(el => {
              // AllTrails: filter private access
              const tags = el.tags || {};
              const access = tags['access'] || '';
              if (access === 'private' || access === 'no') return false;
              // Must have a position
              return !!(el.center?.lat || el.lat || (el.geometry && el.geometry.length > 0));
            })
            .map(el => transformTrailElement(el))
            .filter(t => t.name && (t.start_lat != null) && (t.start_lng != null));

          if (trailsToInsert.length > 0) {
            await supabase
              .from('trails')
              .upsert(trailsToInsert, { onConflict: 'osm_id', ignoreDuplicates: true });
            totalInserted += trailsToInsert.length;
          }
        }
      }

      // Fetch refuges
      if (syncType === 'all' || syncType === 'pois') {
        const refugeElements = await fetchRefuges(bbox, 100);
        totalFetched += refugeElements.length;

        const refugesToInsert = refugeElements
          .filter(el => el.center?.lat || el.lat)
          .map(el => transformPOIElement(el, 'refuge'))
          .filter(p => p.lat && p.lng);

        if (refugesToInsert.length > 0) {
          await supabase
            .from('outdoor_points')
            .upsert(refugesToInsert, { onConflict: 'osm_id', ignoreDuplicates: true });
          totalInserted += refugesToInsert.length;
        }

        // Fetch water points
        const waterElements = await fetchWaterPoints(bbox, 150);
        totalFetched += waterElements.length;

        const waterToInsert = waterElements
          .filter(el => el.center?.lat || el.lat)
          .map(el => transformPOIElement(el, 'water'))
          .filter(p => p.lat && p.lng);

        if (waterToInsert.length > 0) {
          await supabase
            .from('outdoor_points')
            .upsert(waterToInsert, { onConflict: 'osm_id', ignoreDuplicates: true });
          totalInserted += waterToInsert.length;
        }

        // Fetch natural features (summits, viewpoints, waterfalls, etc.)
        const naturalElements = await fetchNaturalFeatures(bbox, 100);
        totalFetched += naturalElements.length;

        const naturalToInsert = naturalElements
          .filter(el => el.center?.lat || el.lat)
          .map(el => {
            const tags = el.tags || {};
            let cat = 'viewpoint';
            if (tags['natural'] === 'peak') cat = 'summit';
            else if (tags['mountain_pass'] === 'yes') cat = 'col';
            else if (tags['natural'] === 'waterfall') cat = 'waterfall';
            else if (tags['natural'] === 'cave_entrance') cat = 'cave';
            else if (tags['tourism'] === 'viewpoint') cat = 'viewpoint';
            return transformPOIElement(el, cat);
          })
          .filter(p => p.lat && p.lng);

        if (naturalToInsert.length > 0) {
          await supabase
            .from('outdoor_points')
            .upsert(naturalToInsert, { onConflict: 'osm_id', ignoreDuplicates: true });
          totalInserted += naturalToInsert.length;
        }

        // Fetch camping
        const campingElements = await fetchCamping(bbox, 50);
        totalFetched += campingElements.length;

        const campingToInsert = campingElements
          .filter(el => el.center?.lat || el.lat)
          .map(el => transformPOIElement(el, 'camping'))
          .filter(p => p.lat && p.lng);

        if (campingToInsert.length > 0) {
          await supabase
            .from('outdoor_points')
            .upsert(campingToInsert, { onConflict: 'osm_id', ignoreDuplicates: true });
          totalInserted += campingToInsert.length;
        }
      }

      // Update sync log
      if (syncId) {
        await supabase
          .from('overpass_sync_log')
          .update({
            status: 'success',
            records_fetched: totalFetched,
            records_inserted: totalInserted,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }

      return NextResponse.json({
        success: true,
        region,
        records_fetched: totalFetched,
        records_inserted: totalInserted,
      });

    } catch (syncError) {
      if (syncId) {
        await supabase
          .from('overpass_sync_log')
          .update({
            status: 'error',
            error_message: String(syncError),
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }
      throw syncError;
    }

  } catch (_err) {
    return NextResponse.json({ error: 'Sync failed', details: String(_err) }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: logs } = await supabase
      .from('overpass_sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    const { count: trailsCount } = await supabase
      .from('trails')
      .select('id', { count: 'exact', head: true });

    const { count: poisCount } = await supabase
      .from('outdoor_points')
      .select('id', { count: 'exact', head: true });

    return NextResponse.json({
      stats: {
        trails: trailsCount || 0,
        outdoor_points: poisCount || 0,
      },
      available_regions: WORLD_REGIONS.map(r => r.name),
      recent_syncs: logs || [],
    });
  } catch (_err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
