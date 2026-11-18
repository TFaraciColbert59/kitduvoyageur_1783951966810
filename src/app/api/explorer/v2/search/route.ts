import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/explorer-v2/pgrest';
import {
  isSearchableViewport,
  viewportCenter,
  type SearchViewport,
} from '@/features/explorer-v2/searchArea';
import {
  applySearchCriteriaOverrides,
  normalizeSearchText,
  parseSearchQuery,
  rankRouteForSearch,
  routeQueryTokens,
  type ParsedDifficulty,
  type ParsedRouteType,
  type ParsedSportIntent,
  type ParsedStartAccess,
  type ParsedSurface,
  type SearchCriteriaOverrides,
  type SearchFilters,
  type SmartRankedRoute,
} from '@/features/explorer-v2/search/searchQueryParser';
import { buildExplorerCatalogAdventures } from '@/features/planning/explorerAdapter';
import { searchMultiDayPlans } from '@/features/planning/library';
import { geocodePlace, type GeocodeMatch } from '@/features/adventure-prep/geocodeService';

export type { SearchFilters };

export const revalidate = 60;

const querySchema = z.object({
  q: z.string().min(2).max(160),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
  zoom: z.coerce.number().min(0).max(22).optional(),
  maxDistanceKm: z.coerce.number().min(1).max(300).optional(),
  maxDurationHours: z.coerce.number().min(0.5).max(48).optional(),
  maxElevGainM: z.coerce.number().min(50).max(10000).optional(),
  easy: z.enum(['0', '1', 'true', 'false']).optional(),
  family: z.enum(['0', '1', 'true', 'false']).optional(),
  routeType: z.enum(['boucle', 'aller-retour', 'traversee']).optional(),
  difficulty: z.enum(['facile', 'modere', 'difficile']).optional(),
  surface: z.enum(['asphalte', 'chemin', 'sentier']).optional(),
  startAccess: z.enum(['gare', 'bus', 'parking']).optional(),
  sport: z.enum(['rando', 'velo', 'gravel', 'vtt', 'course', 'trail', 'ski', 'kayak']).optional(),
});

interface SearchRouteRow {
  id: number;
  name: string | null;
  distance_km: number | null;
  network: string | null;
  ref: string | null;
  geojson: unknown | null;
}

const ROUTE_RPC_LIMIT = 60;
const ROUTE_RESULT_LIMIT = 10;

function normalizeRouteText(value: string): string {
  return normalizeSearchText(value);
}

/** Centre [lng, lat] de l'emprise d'un GeoJSON, sans dépendance cartographique. */
function geojsonCenter(value: unknown): [number, number] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      if (typeof node[0] === 'number' && typeof node[1] === 'number') {
        const lng = node[0];
        const lat = node[1];
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        return;
      }
      for (const child of node) walk(child);
      return;
    }
    if (node && typeof node === 'object') {
      const record = node as { coordinates?: unknown; geometry?: unknown };
      if (record.coordinates !== undefined) walk(record.coordinates);
      if (record.geometry !== undefined) walk(record.geometry);
    }
  };
  walk(value);
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

export function parseQuery(q: string): SearchFilters {
  return parseSearchQuery(q);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    q: params.get('q'),
    lat: params.get('lat') ?? undefined,
    lng: params.get('lng') ?? undefined,
    minLat: params.get('minLat') ?? undefined,
    maxLat: params.get('maxLat') ?? undefined,
    minLng: params.get('minLng') ?? undefined,
    maxLng: params.get('maxLng') ?? undefined,
    zoom: params.get('zoom') ?? undefined,
    maxDistanceKm: params.get('maxDistanceKm') ?? undefined,
    maxDurationHours: params.get('maxDurationHours') ?? undefined,
    maxElevGainM: params.get('maxElevGainM') ?? undefined,
    easy: params.get('easy') ?? undefined,
    family: params.get('family') ?? undefined,
    routeType: params.get('routeType') ?? undefined,
    difficulty: params.get('difficulty') ?? undefined,
    surface: params.get('surface') ?? undefined,
    startAccess: params.get('startAccess') ?? undefined,
    sport: params.get('sport') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'requête invalide' }, { status: 400 });

  const { lat, lng, minLat, maxLat, minLng, maxLng, zoom } = parsed.data;
  const bboxProvided =
    minLat !== undefined || maxLat !== undefined || minLng !== undefined || maxLng !== undefined;
  if (
    bboxProvided &&
    (minLat === undefined || maxLat === undefined || minLng === undefined || maxLng === undefined)
  ) {
    return NextResponse.json(
      { error: 'emprise incomplète', reason: 'invalid-bounds' },
      { status: 400 },
    );
  }
  const viewport: SearchViewport | null = bboxProvided
    ? {
        minLat: minLat as number,
        maxLat: maxLat as number,
        minLng: minLng as number,
        maxLng: maxLng as number,
        zoom: zoom ?? 0,
      }
    : null;
  if (viewport && !(viewport.minLat < viewport.maxLat && viewport.minLng < viewport.maxLng)) {
    return NextResponse.json(
      { error: 'emprise invalide', reason: 'invalid-bounds' },
      { status: 400 },
    );
  }
  // Le client exige un zoom de ville et borne l'emprise à 2° de côté, plus
  // strictement que la limite de 6° des RPC. Refuser explicitement évite de
  // présenter une limite comme un résultat vide.
  if (viewport && !isSearchableViewport(viewport)) {
    return NextResponse.json(
      { error: 'emprise trop vaste', reason: 'zone-too-large' },
      { status: 422 },
    );
  }

  const overrides: SearchCriteriaOverrides = {
    ...(parsed.data.maxDistanceKm !== undefined ? { maxDistanceKm: parsed.data.maxDistanceKm } : {}),
    ...(parsed.data.maxDurationHours !== undefined
      ? { maxDurationHours: parsed.data.maxDurationHours }
      : {}),
    ...(parsed.data.maxElevGainM !== undefined ? { maxElevGainM: parsed.data.maxElevGainM } : {}),
    ...(parsed.data.easy !== undefined
      ? { easy: parsed.data.easy === '1' || parsed.data.easy === 'true' }
      : {}),
    ...(parsed.data.family !== undefined
      ? { family: parsed.data.family === '1' || parsed.data.family === 'true' }
      : {}),
    ...(parsed.data.routeType !== undefined
      ? { routeType: parsed.data.routeType as ParsedRouteType }
      : {}),
    ...(parsed.data.difficulty !== undefined
      ? { difficulty: parsed.data.difficulty as ParsedDifficulty }
      : {}),
    ...(parsed.data.surface !== undefined ? { surface: parsed.data.surface as ParsedSurface } : {}),
    ...(parsed.data.startAccess !== undefined
      ? { startAccess: parsed.data.startAccess as ParsedStartAccess }
      : {}),
    ...(parsed.data.sport !== undefined ? { sport: parsed.data.sport as ParsedSportIntent } : {}),
  };
  const filters = applySearchCriteriaOverrides(parseQuery(parsed.data.q), overrides);

  // K1.13 : recherche multi-jours dans le catalogue public lorsque la demande s'y prête
  const adventures = filters.isMultiDay || (filters.multiDayDays && filters.multiDayDays >= 2)
    ? searchMultiDayPlans(
        buildExplorerCatalogAdventures(),
        { rawQuery: parsed.data.q },
        { viewerId: null, friendIds: [], tribuIds: [], blockedUserIds: [] }
      ).items.slice(0, 4)
    : [];

  let resolvedPlace: {
    query: string;
    selected: GeocodeMatch;
    candidates: GeocodeMatch[];
  } | null = null;
  let resolvedZone: SearchViewport | null = viewport;
  let center = viewport
    ? { lat: viewportCenter(viewport)[1], lng: viewportCenter(viewport)[0] }
    : lat !== undefined && lng !== undefined
      ? { lat, lng }
      : null;

  // D1.5 : résoudre la commune avant de chercher les traces (sans GPS ou avec lieu nommé).
  const placeCandidate = !viewport ? extractPlaceCandidate(parsed.data.q, filters) : null;
  if (placeCandidate) {
    try {
      const geo = await geocodePlace(placeCandidate, 'fr');
      if (geo.status === 'ok' && geo.matches.length > 0) {
        const selected = geo.matches[0];
        resolvedPlace = {
          query: placeCandidate,
          selected,
          candidates: geo.matches.slice(0, 5),
        };
        center = { lat: selected.lat, lng: selected.lon };
        resolvedZone = {
          minLat: selected.lat - 0.09,
          maxLat: selected.lat + 0.09,
          minLng: selected.lon - 0.14,
          maxLng: selected.lon + 0.14,
          zoom: parsed.data.zoom ?? 12,
        };
      }
    } catch {
      /* géocodage indisponible : on garde le centre existant le cas échéant */
    }
  }

  try {
    if (!center) {
      return NextResponse.json({
        filters,
        results: [],
        routes: [],
        adventures,
        resolvedPlace,
        zone: resolvedZone,
        truncated: false,
        routesTruncated: false,
        routesUnavailable: false,
      });
    }
    const dLat = 0.09;
    const dLng = 0.14;
    const searchWindow = resolvedZone ?? {
      minLat: center.lat - dLat,
      maxLat: center.lat + dLat,
      minLng: center.lng - dLng,
      maxLng: center.lng + dLng,
      zoom: parsed.data.zoom ?? 12,
    };
    const [pois, routeRows] = await Promise.all([
      rpc<
        Array<{
          id: string;
          kind: string;
          subtype: string;
          name: string;
          lat: number;
          lon: number;
          ele_m: number | null;
          potable: boolean | null;
        }>
      >(
        'explorer_pois',
        {
          p_min_lat: searchWindow.minLat,
          p_min_lng: searchWindow.minLng,
          p_max_lat: searchWindow.maxLat,
          p_max_lng: searchWindow.maxLng,
          p_kinds: filters.kinds,
          p_limit: 80,
        },
        60,
      ),
      // Une panne du catalogue de parcours ne doit pas emporter la recherche
      // de repères : on la signale explicitement, sans fabriquer de résultats.
      rpc<SearchRouteRow[]>(
        'explorer_routes',
        {
          p_min_lat: searchWindow.minLat,
          p_min_lng: searchWindow.minLng,
          p_max_lat: searchWindow.maxLat,
          p_max_lng: searchWindow.maxLng,
          p_limit: ROUTE_RPC_LIMIT,
        },
        60,
      ).catch((error) => {
        console.error('[explorer-v2] search routes', error);
        return null;
      }),
    ]);

    const text = filters.text.toLowerCase();
    const filtered = pois
      .map((poi) => ({
        ...poi,
        distanceKm: haversine(center.lat, center.lng, poi.lat, poi.lon),
      }))
      .filter((poi) => (filters.maxDistanceKm ? poi.distanceKm <= filters.maxDistanceKm : true))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    const results = filtered
      .slice(0, 20)
      .map((poi) => ({
        ...poi,
        // Le nom n'est pas réécrit : on garde le libellé OSM exact.
        matched: poi.name.toLowerCase().includes(text),
      }));

    const routeTokens = routeQueryTokens(filters.text);
    const routeMatched = (route: SearchRouteRow) => {
      if (routeTokens.length === 0) return false;
      const haystack = normalizeRouteText(`${route.name ?? ''} ${route.ref ?? ''}`);
      return routeTokens.every((token) => haystack.includes(token));
    };
    const routeCandidates = (routeRows ?? [])
      .map((route) => {
        const routeCenter = geojsonCenter(route.geojson);
        const distanceKm = routeCenter
          ? haversine(center.lat, center.lng, routeCenter[1], routeCenter[0])
          : null;
        const matched = routeMatched(route);
        const ranked = rankRouteForSearch(
          {
            id: route.id,
            name: route.name,
            ref: route.ref,
            network: route.network,
            distance_km: route.distance_km,
            distanceKm,
            matched,
          },
          filters
        );
        return { route, ranked };
      })
      .filter(
        ({ route }) =>
          (filters.maxDistanceKm === null ||
            route.distance_km === null ||
            route.distance_km <= filters.maxDistanceKm) &&
          (filters.minDistanceKm == null ||
            route.distance_km === null ||
            route.distance_km >= filters.minDistanceKm)
      )
      .sort(
        (a, b) =>
          (b.ranked.smartScore ?? 0) - (a.ranked.smartScore ?? 0) ||
          (a.ranked.distanceKm ?? Infinity) - (b.ranked.distanceKm ?? Infinity) ||
          (a.route.distance_km ?? Infinity) - (b.route.distance_km ?? Infinity),
      );
    const routes: SmartRankedRoute[] = routeCandidates
      .slice(0, ROUTE_RESULT_LIMIT)
      .map(({ ranked }) => ranked);

    return NextResponse.json({
      filters,
      results,
      routes,
      adventures,
      resolvedPlace,
      zone: resolvedZone,
      truncated: pois.length >= 80 && filtered.length > 20,
      routesTruncated:
        routeRows !== null &&
        routeRows.length >= ROUTE_RPC_LIMIT &&
        routeCandidates.length > ROUTE_RESULT_LIMIT,
      routesUnavailable: routeRows === null,
    });
  } catch (error) {
    console.error('[explorer-v2] search', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}

function extractPlaceCandidate(rawQuery: string, filters: SearchFilters): string | null {
  const prepMatch = rawQuery.match(/\b(?:autour de|pr[èe]s de|vers|dans le|dans la|en|[àa])\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’\-\s]{1,40})/i);
  if (prepMatch?.[1]) {
    const cleaned = prepMatch[1].trim().replace(/\s+\d+\s*(km|h|m)\b.*$/i, '').trim();
    if (cleaned.length >= 2) return cleaned;
  }
  const text = (filters.text ?? '').trim();
  if (text.length >= 2 && !/^(boucle|rando|randonnee|velo|gravel|vtt|sentier|lac|foret|sommet)$/i.test(text)) {
    return text;
  }
  return null;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
