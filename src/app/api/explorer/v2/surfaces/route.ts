import { NextRequest, NextResponse } from 'next/server';
import { parseOptionalBbox, VIEWPORT_RATE_LIMIT } from '@/lib/geo/requestViewport';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { executeOverpassQuery } from '@/lib/geo/overpassAdapter';
import {
  calculateBboxGeodesicAreaKm2,
  MAX_OVERPASS_GEODESIC_AREA_KM2,
} from '@/lib/geo/geometry';
import { overpassCircuitBreaker } from '@/lib/geo/cacheService';
import { analyzeSurfaces, type SurfaceSectionInput } from '@/features/routes/analysis/surfaces';

export const dynamic = 'force-dynamic';

export interface SurfaceMapFeature {
  id: string;
  name: string | null;
  surface: string | null;
  wayType: string | null;
  category: string;
  coordinates: Array<[number, number]>;
}

/**
 * GET /api/explorer/v2/surfaces?min_lat=...&max_lat=...&min_lng=...&max_lng=...
 *
 * K3.04 — Lit les étiquettes `surface` / `highway` réelles d'OpenStreetMap dans la zone
 * du tracé et exécute `analyzeSurfaces` sans jamais inventer de revêtement.
 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-surfaces',
    ...VIEWPORT_RATE_LIMIT,
  });
  if (limited) return limited;

  const viewport = parseOptionalBbox(request.nextUrl.searchParams);
  if (!viewport.ok) return viewport.response;
  if (!viewport.bbox) {
    return NextResponse.json(
      { error: 'Paramètres géographiques requis', code: 'BBOX_REQUIRED' },
      { status: 400 },
    );
  }

  const { minLat, maxLat, minLng, maxLng } = viewport.bbox;
  const areaKm2 = calculateBboxGeodesicAreaKm2({
    south: minLat,
    west: minLng,
    north: maxLat,
    east: maxLng,
  });
  if (areaKm2 > MAX_OVERPASS_GEODESIC_AREA_KM2) {
    return NextResponse.json({
      status: 'zoom_required',
      analysis: null,
      features: [],
      reason: 'Zoome sur le tracé pour analyser les surfaces OSM.',
    });
  }

  if (overpassCircuitBreaker.isOpen()) {
    return NextResponse.json({
      status: 'unavailable',
      analysis: null,
      features: [],
      reason: 'Source OSM indisponible.',
    });
  }

  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:15];way["highway"]["surface"](${bboxStr});out geom 120;`;

  try {
    const payload = (await executeOverpassQuery(query, {
      config: { timeoutSeconds: 15, maxSizeBytes: 8_388_608, userAgent: 'LKDV/1.0 route-surfaces' },
      signal: request.signal,
    })) as {
      elements?: Array<{
        id?: number;
        tags?: Record<string, string>;
        geometry?: Array<{ lat: number; lon: number }>;
      }>;
    };

    const elements = Array.isArray(payload?.elements) ? payload.elements : [];
    const sections: SurfaceSectionInput[] = [];
    const rawFeatures: Array<{
      id: string;
      name: string | null;
      surface: string | null;
      wayType: string | null;
      coordinates: Array<[number, number]>;
    }> = [];
    let cursorM = 0;

    for (const el of elements) {
      const geom = Array.isArray(el.geometry) ? el.geometry : [];
      if (geom.length < 2) continue;
      const coords = geom
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
        .map((p): [number, number] => [p.lon, p.lat]);
      if (coords.length < 2) continue;

      let segM = 0;
      for (let i = 1; i < coords.length; i += 1) {
        const [lon1, lat1] = coords[i - 1];
        const [lon2, lat2] = coords[i];
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        segM += 2 * 6_371_000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      if (segM <= 0) continue;
      const fromM = cursorM;
      cursorM += segM;
      const surface = el.tags?.surface?.trim() || null;
      const wayType = el.tags?.highway?.trim() || null;
      const name = el.tags?.name?.trim() || null;
      sections.push({ fromM, toM: cursorM, surface, wayType, name });
      rawFeatures.push({
        id: `osm-way-${el.id ?? rawFeatures.length}`,
        name,
        surface,
        wayType,
        coordinates: coords,
      });
    }

    if (sections.length === 0) {
      return NextResponse.json({
        status: 'empty',
        analysis: null,
        features: [],
        reason: 'Aucune étiquette surface OSM trouvée dans cette zone.',
      });
    }

    const analysis = analyzeSurfaces({ sections, totalLengthM: cursorM });
    const features: SurfaceMapFeature[] = rawFeatures.map((feat, idx) => ({
      ...feat,
      category: analysis.sections[idx]?.category ?? 'unknown',
    }));

    return NextResponse.json(
      {
        status: analysis.status,
        analysis,
        features,
        provider: 'OpenStreetMap (Overpass · ODbL)',
      },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch {
    return NextResponse.json({
      status: 'unavailable',
      analysis: null,
      features: [],
      reason: 'Analyse de surface indisponible.',
    });
  }
}
