import { NextRequest, NextResponse } from 'next/server';
import { parseOptionalBbox, VIEWPORT_RATE_LIMIT } from '@/lib/geo/requestViewport';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  analyzeFireAlerts,
  type FireIncident,
  type FireSource,
} from '@/features/routes/analysis/fire';

export const dynamic = 'force-dynamic';

/**
 * Parse les lignes CSV VIIRS/MODIS de NASA FIRMS en incidents géolocalisés réels.
 * Aucun incident n'est créé sans coordonnées valides.
 */
export function parseFirmsCsv(csv: string): FireIncident[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((col) => col.trim().toLowerCase());
  const latIdx = header.indexOf('latitude');
  const lonIdx = header.indexOf('longitude');
  const dateIdx = header.indexOf('acq_date');
  const confIdx = header.indexOf('confidence');
  if (latIdx < 0 || lonIdx < 0) return [];

  const incidents: FireIncident[] = [];
  for (let i = 1; i < Math.min(lines.length, 300); i += 1) {
    const cols = lines[i].split(',');
    const lat = Number(cols[latIdx]);
    const lon = Number(cols[lonIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const acqDate = dateIdx >= 0 ? cols[dateIdx]?.trim() || null : null;
    const confidence = confIdx >= 0 ? cols[confIdx]?.trim() || null : null;
    incidents.push({
      id: `firms-${i}-${lat.toFixed(4)}:${lon.toFixed(4)}`,
      kind: 'hotspot',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      radiusM: 375,
      label: confidence ? `Point chaud satellite (${confidence})` : 'Point chaud satellite',
      source: 'NASA FIRMS (VIIRS)',
      observedAt: acqDate ? `${acqDate}T00:00:00Z` : null,
      closure: false,
    });
  }
  return incidents;
}

/**
 * GET /api/explorer/v2/fires?min_lat=...&max_lat=...&min_lng=...&max_lng=...
 *
 * K3.14 — Feux actifs et zones brûlées.
 * Sans clé officielle (`NASA_FIRMS_MAP_KEY`), la route renvoie explicitement
 * `status: 'unavailable'` et une liste vide : aucune alerte n'est fabriquée.
 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-fires',
    ...VIEWPORT_RATE_LIMIT,
  });
  if (limited) return limited;

  const normalizedParams = new URLSearchParams(request.nextUrl.searchParams);
  if (!normalizedParams.has('min_lat') && normalizedParams.has('minLat')) {
    normalizedParams.set('min_lat', normalizedParams.get('minLat') ?? '');
  }
  if (!normalizedParams.has('max_lat') && normalizedParams.has('maxLat')) {
    normalizedParams.set('max_lat', normalizedParams.get('maxLat') ?? '');
  }
  if (!normalizedParams.has('min_lng') && normalizedParams.has('minLng')) {
    normalizedParams.set('min_lng', normalizedParams.get('minLng') ?? '');
  }
  if (!normalizedParams.has('max_lng') && normalizedParams.has('maxLng')) {
    normalizedParams.set('max_lng', normalizedParams.get('maxLng') ?? '');
  }

  const viewport = parseOptionalBbox(normalizedParams);
  if (!viewport.ok) return viewport.response;
  if (!viewport.bbox) {
    return NextResponse.json(
      { error: 'Paramètres géographiques requis', code: 'BBOX_REQUIRED' },
      { status: 400 },
    );
  }

  const firmsKey = process.env.NASA_FIRMS_MAP_KEY?.trim() ?? '';
  if (!firmsKey) {
    const analysis = analyzeFireAlerts({ incidents: null });
    return NextResponse.json(
      {
        status: analysis.status,
        source: null,
        incidents: [],
        layer: [],
        reason: 'Source feux actifs non configurée (NASA_FIRMS_MAP_KEY requise).',
      },
      { status: 200, headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  }

  const { minLng, minLat, maxLng, maxLat } = viewport.bbox;
  const areaParam = `${minLng.toFixed(3)},${minLat.toFixed(3)},${maxLng.toFixed(3)},${maxLat.toFixed(3)}`;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(firmsKey)}/VIIRS_SNPP_NRT/${areaParam}/2`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]),
      cache: 'no-store',
    });
    if (!res.ok) {
      const analysis = analyzeFireAlerts({ incidents: null });
      return NextResponse.json({
        status: analysis.status,
        source: null,
        incidents: [],
        layer: [],
        reason: `Fournisseur NASA FIRMS indisponible (${res.status})`,
      });
    }
    const csv = await res.text();
    const incidents = parseFirmsCsv(csv);
    const source: FireSource = {
      name: 'NASA FIRMS · VIIRS NRT (48 h)',
      retrievedAt: new Date().toISOString(),
      license: 'NASA EOSDIS Open Data',
    };
    const analysis = analyzeFireAlerts({
      incidents,
      source,
      points: [
        { lat: minLat, lon: minLng },
        { lat: maxLat, lon: maxLng },
      ],
    });
    return NextResponse.json(
      {
        status: incidents.length > 0 ? 'ok' : analysis.status,
        source: analysis.source,
        incidents,
        layer: analysis.layer,
      },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' } },
    );
  } catch {
    const analysis = analyzeFireAlerts({ incidents: null });
    return NextResponse.json({
      status: analysis.status,
      source: null,
      incidents: [],
      layer: [],
      reason: 'Source NASA FIRMS momentanément inaccessible.',
    });
  }
}
