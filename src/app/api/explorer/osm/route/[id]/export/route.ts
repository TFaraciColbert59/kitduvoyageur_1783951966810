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

function extractCoords(geometry: unknown, out: GeoCoord[]): void {
  if (!geometry || typeof geometry !== 'object') return;
  const geo = geometry as {
    type?: string;
    coordinates?: unknown;
    geometry?: unknown;
    features?: Array<{ geometry?: unknown }>;
  };
  if (geo.type === 'Feature' && geo.geometry) {
    extractCoords(geo.geometry, out);
    return;
  }
  if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
    for (const f of geo.features) {
      if (f?.geometry) extractCoords(f.geometry, out);
    }
    return;
  }
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
}

function unwrapCachedRoute(
  cachedData: unknown
): { name?: string; geojson?: unknown; geometry?: unknown } | null {
  if (!cachedData || typeof cachedData !== 'object') return null;
  const record = cachedData as {
    route?: unknown;
    name?: unknown;
    geojson?: unknown;
    geometry?: unknown;
  };
  const candidate =
    record.route && typeof record.route === 'object'
      ? (record.route as { name?: unknown; geojson?: unknown; geometry?: unknown })
      : record;
  if (!candidate.geojson && !candidate.geometry) return null;
  return {
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    geojson: candidate.geojson,
    geometry: candidate.geometry,
  };
}

function extractOverpassRelationElement(raw: unknown, numericOsmId: number): unknown {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as {
    type?: unknown;
    elements?: Array<{ type?: unknown; id?: unknown }>;
  };
  if (Array.isArray(payload.elements)) {
    return (
      payload.elements.find((e) => e?.type === 'relation' && e?.id === numericOsmId) ??
      payload.elements.find((e) => e?.type === 'relation') ??
      payload.elements[0] ??
      null
    );
  }
  if (payload.type === 'relation') return payload;
  return null;
}

function cachedRouteGeometry(cachedRoute: unknown): unknown {
  if (!cachedRoute || typeof cachedRoute !== 'object') return null;
  const route = cachedRoute as { geojson?: unknown; geometry?: unknown };
  // `ExternalRouteDetail.geojson` est la source de vérité ; `geometry`
  // reste acceptée pour les entrées de cache antérieures à la migration.
  return route.geojson ?? route.geometry ?? null;
}

function pointsFromGeoJsonGeometry(geometry: unknown): GeoCoord[] {
  const out: GeoCoord[] = [];
  extractCoords(geometry, out);
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
        const cachedRoute = unwrapCachedRoute(cached?.data);
        const cachedGeometry = cachedRoute ? cachedRouteGeometry(cachedRoute) : null;
        if (cachedGeometry) {
          points = pointsFromGeoJsonGeometry(cachedGeometry);
        } else {
          const raw = await queryRouteDetail(hikingRoute.osm_relation_id);
          const relationElem = extractOverpassRelationElement(raw, hikingRoute.osm_relation_id);
          const norm = relationElem ? normalizeOsmRelationDetail(relationElem) : null;
          if (norm?.geojson) {
            osmRouteDetailCache.set(`route-detail:${hikingRoute.osm_relation_id}`, norm);
            points = pointsFromGeoJsonGeometry(norm.geojson);
          }
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
    const cachedRoute = unwrapCachedRoute(cached?.data);
    if (cachedRoute) {
      routeName = cachedRoute.name || routeName;
      points = pointsFromGeoJsonGeometry(cachedRouteGeometry(cachedRoute));
    } else {
      try {
        const raw = await queryRouteDetail(numericOsmId);
        const relationElem = extractOverpassRelationElement(raw, numericOsmId);
        const norm = relationElem ? normalizeOsmRelationDetail(relationElem) : null;
        if (!norm) {
          return fail('not_found', 'Itinéraire OSM introuvable.');
        }
        osmRouteDetailCache.set(`route-detail:${numericOsmId}`, norm);
        routeName = norm.name || routeName;
        points = pointsFromGeoJsonGeometry(norm.geojson);
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
