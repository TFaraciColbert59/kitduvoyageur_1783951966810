/**
 * Lot A03 — K6.05 & S3.27 : Export GPX / TCX d'un itinéraire OSM/Parcours
 * ou d'un parcours planifié importé depuis le drawer Explorer/Parcours.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import { queryRouteDetail } from '@/features/explorer-osm/adapters/overpassAdapter';
import { normalizeOsmRelationDetail } from '@/features/explorer-osm/services/normalizationService';
import { osmRouteDetailCache } from '@/features/explorer-osm/services/cacheService';
import { buildRouteGpx, buildRouteTcx } from '@/features/hiking/import/routeImport';
import { createClient } from '@/lib/supabase/server';
import type { GeoCoord } from '@/features/hiking/import/snapToTrails';
import type { NormalizedTraceWaypoint } from '@/features/hiking/import/model';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeFilename(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'parcours'
  );
}

function pointsFromGeoJsonGeometry(geometry: unknown): GeoCoord[] {
  if (!geometry || typeof geometry !== 'object') return [];
  const geo = geometry as { type?: string; coordinates?: unknown };
  const out: GeoCoord[] = [];
  if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
    for (const c of geo.coordinates) {
      if (Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number') {
        out.push({ lat: c[1], lng: c[0], ...(typeof c[2] === 'number' ? { altitudeM: c[2] } : {}) });
      }
    }
  } else if (geo.type === 'MultiLineString' && Array.isArray(geo.coordinates)) {
    for (const line of geo.coordinates) {
      if (!Array.isArray(line)) continue;
      for (const c of line) {
        if (Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number') {
          out.push({ lat: c[1], lng: c[0], ...(typeof c[2] === 'number' ? { altitudeM: c[2] } : {}) });
        }
      }
    }
  }
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = (request as { nextUrl?: URL }).nextUrl?.searchParams ?? new URL(request.url).searchParams;
  const formatParam = searchParams.get('format')?.toLowerCase() ?? 'gpx';
  if (formatParam !== 'gpx' && formatParam !== 'tcx') {
    return fail('bad_request', 'Format invalide : gpx ou tcx attendu.');
  }

  let routeName = `Parcours ${id}`;
  let points: GeoCoord[] = [];
  let waypoints: NormalizedTraceWaypoint[] = [];

  if (UUID_RE.test(id)) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: userRoute } = await supabase
      .from('user_imported_routes')
      .select('id, user_id, title, geometry_mode, original_points, snapped_points, waypoints, visibility')
      .eq('id', id)
      .maybeSingle();

    if (userRoute) {
      if (userRoute.visibility !== 'public' && userRoute.user_id !== user?.id) {
        return fail('forbidden', 'Ce parcours privé ne peut pas être exporté.');
      }
      routeName = userRoute.title;
      const chosen =
        userRoute.geometry_mode === 'snapped' && Array.isArray(userRoute.snapped_points) && userRoute.snapped_points.length > 0
          ? userRoute.snapped_points
          : userRoute.original_points;
      points = Array.isArray(chosen) ? (chosen as GeoCoord[]) : [];
      waypoints = Array.isArray(userRoute.waypoints) ? (userRoute.waypoints as NormalizedTraceWaypoint[]) : [];
    } else {
      const { data: hikingRoute } = await supabase
        .from('hiking_routes')
        .select('id, osm_relation_id, name')
        .eq('id', id)
        .maybeSingle();
      if (!hikingRoute) {
        return fail('not_found', 'Parcours introuvable.');
      }
      routeName = hikingRoute.name || routeName;
      if (hikingRoute.osm_relation_id) {
        const cached = osmRouteDetailCache.get(`route-detail:${hikingRoute.osm_relation_id}`);
        if (cached?.data?.route?.geometry) {
          points = pointsFromGeoJsonGeometry(cached.data.route.geometry);
        } else {
          const raw = await queryRouteDetail(hikingRoute.osm_relation_id);
          const norm = normalizeOsmRelationDetail(raw);
          if (norm?.geometry) points = pointsFromGeoJsonGeometry(norm.geometry);
        }
      }
    }
  } else {
    const cleanId = id.startsWith('osm:relation:') ? id.replace('osm:relation:', '') : id;
    const numericOsmId = parseInt(cleanId, 10);
    if (!Number.isFinite(numericOsmId) || numericOsmId <= 0) {
      return fail('bad_request', 'Identifiant de parcours invalide.');
    }

    const cached = osmRouteDetailCache.get(`route-detail:${numericOsmId}`);
    if (cached?.data?.route) {
      routeName = cached.data.route.name || routeName;
      points = pointsFromGeoJsonGeometry(cached.data.route.geometry);
    } else {
      try {
        const raw = await queryRouteDetail(numericOsmId);
        const norm = normalizeOsmRelationDetail(raw);
        if (!norm) {
          return fail('not_found', 'Itinéraire OSM introuvable.');
        }
        routeName = norm.name || routeName;
        points = pointsFromGeoJsonGeometry(norm.geometry);
      } catch {
        return fail('server', 'Impossible de charger la géométrie de cet itinéraire.');
      }
    }
  }

  if (points.length === 0) {
    return fail('not_found', 'Aucune géométrie exploitable pour exporter ce parcours.');
  }

  const payload =
    formatParam === 'tcx'
      ? buildRouteTcx({ id, name: routeName, points, waypoints })
      : buildRouteGpx({ id, name: routeName, points, waypoints });

  const ext = formatParam === 'tcx' ? 'tcx' : 'gpx';
  const contentType =
    formatParam === 'tcx'
      ? 'application/vnd.garmin.tcx+xml; charset=utf-8'
      : 'application/gpx+xml; charset=utf-8';

  return new NextResponse(payload, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${sanitizeFilename(routeName)}.${ext}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
