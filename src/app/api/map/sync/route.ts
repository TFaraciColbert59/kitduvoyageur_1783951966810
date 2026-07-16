import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchHikingTrails,
  fetchRefuges,
  fetchWaterPoints,
  fetchNaturalFeatures,
  fetchCamping,
  transformWayElement,
  transformRelationElement,
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
    const force = true;

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
      const defaultRegion = WORLD_REGIONS[0];
      bbox = defaultRegion.bbox;
      country = defaultRegion.country;
      region = defaultRegion.name;
    }

    // Cleanup stuck 'running' entries older than 5 minutes
    await supabase
      .from('overpass_sync_log')
      .update({ status: 'error', error_message: 'Timed out (auto-cleanup)', completed_at: new Date().toISOString() })
      .eq('region', region)
      .eq('status', 'running')
      .lt('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (!force) {
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
    }

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
    let validGPSTrails = 0;
    let rejectedTrails = 0;
    const errors: string[] = [];

    try {
      // ── Fetch trails with COMPLETE GPS geometry ──────────────
      if (syncType === 'all' || syncType === 'trails') {
        const tiles = getTilesForBBox(bbox);
        // Process max 2 tiles to stay within 60s budget
        const tilesToProcess = tiles.slice(0, 2);

        for (const tile of tilesToProcess) {
          try {
            console.log(`[Sync] Processing tile [${tile.south},${tile.west}→${tile.north},${tile.east}]`);

            // FIXED: fetchHikingTrails now returns {ways, relations, wayMap}
            const { ways, relations, wayMap } = await fetchHikingTrails(tile, 50);
            totalFetched += ways.length + relations.length;

            console.log(`[Sync] Tile: ${ways.length} ways, ${relations.length} relations, ${wayMap.size} way geometries`);

            const trailsToInsert: ReturnType<typeof transformWayElement>[] = [];

            // Process ways — each has geometry directly
            for (const way of ways) {
              const tags = way.tags || {};
              const access = tags['access'] || '';
              if (access === 'private' || access === 'no') continue;

              const trail = transformWayElement(way);
              if (trail && trail.name && trail.start_lat != null && trail.geojson) {
                // Validate: must have real GPS trace (min 10 points, not straight line)
                const coords = trail.geojson.coordinates as number[][];
                if (coords.length >= 10) {
                  trailsToInsert.push(trail);
                  validGPSTrails++;
                } else {
                  rejectedTrails++;
                }
              } else {
                rejectedTrails++;
              }
            }

            // Process relations — reconstruct GPS from member ways
            for (const relation of relations) {
              const trail = transformRelationElement(relation, wayMap);
              if (trail && trail.name && trail.start_lat != null && trail.geojson) {
                const coords = trail.geojson.coordinates as number[][];
                if (coords.length >= 10) {
                  trailsToInsert.push(trail);
                  validGPSTrails++;
                } else {
                  rejectedTrails++;
                }
              } else {
                rejectedTrails++;
              }
            }

            console.log(`[Sync] Tile result: ${trailsToInsert.length} valid GPS trails, ${rejectedTrails} rejected`);

            if (trailsToInsert.length > 0) {
              const { error: upsertErr } = await supabase
                .from('trails')
                .upsert(trailsToInsert.filter(Boolean) as NonNullable<typeof trailsToInsert[0]>[], { onConflict: 'osm_id', ignoreDuplicates: false });

              if (upsertErr) {
                errors.push(`Trails upsert: ${upsertErr.message}`);
              } else {
                totalInserted += trailsToInsert.length;
              }
            }
          } catch (tileErr) {
            const msg = `Tile [${tile.south},${tile.west}→${tile.north},${tile.east}]: ${String(tileErr)}`;
            errors.push(msg);
            console.error('[Overpass sync] Trail tile error:', msg);
          }
        }
      }

      // ── Fetch POIs ───────────────────────────────────────────
      if (syncType === 'all' || syncType === 'pois') {
        try {
          const refugeElements = await fetchRefuges(bbox, 50);
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
        } catch (err) {
          errors.push(`Refuges: ${String(err)}`);
        }

        try {
          const waterElements = await fetchWaterPoints(bbox, 50);
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
        } catch (err) {
          errors.push(`Water: ${String(err)}`);
        }

        try {
          const naturalElements = await fetchNaturalFeatures(bbox, 50);
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
        } catch (err) {
          errors.push(`Natural features: ${String(err)}`);
        }

        try {
          const campingElements = await fetchCamping(bbox, 30);
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
        } catch (err) {
          errors.push(`Camping: ${String(err)}`);
        }
      }

      const allFailed = errors.length > 0 && totalFetched === 0;
      const finalStatus = allFailed ? 'error' : 'success';

      if (syncId) {
        await supabase
          .from('overpass_sync_log')
          .update({
            status: finalStatus,
            records_fetched: totalFetched,
            records_inserted: totalInserted,
            error_message: errors.length > 0 ? errors.join('\n') : null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }

      if (allFailed) {
        return NextResponse.json({
          success: false,
          region,
          error: 'Overpass API unreachable — all requests failed',
          details: errors,
          hint: 'Run GET /api/map/test-overpass to diagnose connectivity',
        }, { status: 503 });
      }

      return NextResponse.json({
        success: true,
        region,
        records_fetched: totalFetched,
        records_inserted: totalInserted,
        valid_gps_trails: validGPSTrails,
        rejected_trails: rejectedTrails,
        errors: errors.length > 0 ? errors : undefined,
        message: `Sync terminée: ${validGPSTrails} sentiers GPS valides (≥10 points), ${rejectedTrails} rejetés (géométrie insuffisante)`,
      });

    } catch (innerErr) {
      if (syncId) {
        await supabase
          .from('overpass_sync_log')
          .update({
            status: 'error',
            error_message: String(innerErr),
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }
      throw innerErr;
    }

  } catch (err) {
    console.error('[Sync] Fatal error:', err);
    return NextResponse.json({
      success: false,
      error: String(err),
    }, { status: 500 });
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
