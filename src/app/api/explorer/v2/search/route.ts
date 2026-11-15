import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/explorer-v2/pgrest';
import {
  isSearchableViewport,
  viewportCenter,
  type SearchViewport,
} from '@/features/explorer-v2/searchArea';
import type { SearchRoute } from '@/features/explorer-v2/state/types';

export const revalidate = 60;

const querySchema = z.object({
  q: z.string().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
  zoom: z.coerce.number().min(0).max(22).optional(),
});

/**
 * Recherche en langage naturel (05_DONNEES §6) : analyseur déterministe de
 * règles, **sans modèle payant**. La requête est transformée en filtres
 * explicites, et les résultats viennent uniquement de la base.
 */
export interface SearchFilters {
  kinds: string[];
  maxDistanceKm: number | null;
  easy: boolean;
  family: boolean;
  withWater: boolean;
  text: string;
}

interface SearchRouteRow {
  id: number;
  name: string | null;
  distance_km: number | null;
  network: string | null;
  ref: string | null;
  geojson: unknown | null;
}

/**
 * Le catalogue `hiking_routes` est public (RLS OSM) mais `explorer_routes`
 * n'expose pas de recherche plein texte : la RPC rend les tracés d'une emprise
 * bornée. On garde cette borne et on classe les noms/références côté serveur,
 * sans nouvel index ni résultat inventé. `compas_search_routes` existe mais
 * n'est exécutable que par `authenticated` : l'API Explorer utilise la clé
 * anonyme, donc elle ne peut pas l'appeler sans contourner les droits.
 */
const ROUTE_RPC_LIMIT = 60;
const ROUTE_RESULT_LIMIT = 8;

/** Mots d'intention qui ne désignent pas un nom de parcours. */
const ROUTE_QUERY_STOPWORDS = new Set([
  'rando',
  'randonnee',
  'randonnees',
  'marche',
  'parcours',
  'itineraire',
  'sentier',
  'boucle',
  'facile',
  'faciles',
  'debutant',
  'debutante',
  'famille',
  'enfants',
  'enfant',
  'accessible',
  'poussette',
  'moins',
  'heure',
  'heures',
  'km',
  'pres',
  'proche',
  'autour',
  'avec',
  'pour',
  'dans',
  'vers',
  'depuis',
  'entre',
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'un',
  'une',
  'au',
  'aux',
  'sur',
  'en',
  'et',
  'ou',
  'point',
  'eau',
  'refuge',
  'sommet',
  'vue',
  'parking',
  'max',
  'maximum',
  'sous',
  'tres',
]);

function normalizeRouteText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function routeQueryTokens(value: string): string[] {
  return normalizeRouteText(value)
    .split(' ')
    .filter((token) => token.length >= 2 && !ROUTE_QUERY_STOPWORDS.has(token));
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

const KIND_WORDS: Array<{ kind: string; words: RegExp }> = [
  { kind: 'water', words: /\b(eau|source|fontaine|lac|rivi[eè]re|point d.eau|aiguade)\b/i },
  { kind: 'refuge', words: /\b(refuge|refuges|cabane|chalet|hutte)\b/i },
  { kind: 'summit', words: /\b(sommet|pic|cime|c[îi]me|mont|aiguille|peak)\b/i },
  { kind: 'bivouac', words: /\b(bivouac|bivouaquer|camp|tente|dormir dehors)\b/i },
  { kind: 'viewpoint', words: /\b(belv[ée]d[èe]re|point de vue|panorama|vue)\b/i },
  { kind: 'access', words: /\b(parking|gare|arr[êe]t|bus|acc[èe]s|d[ée]part)\b/i },
];

export function parseQuery(q: string): SearchFilters {
  const kinds = KIND_WORDS.filter((entry) => entry.words.test(q)).map((entry) => entry.kind);
  const hours = q.match(/(?:\b(?:moins de|max(?:imum)?|sous|environ)\s*)?(\d+)\s*heures?\b/i);
  const km = q.match(/(?:\b(?:moins de|max(?:imum)?|sous|environ)\s*)?(\d+)\s*km\b/i);
  const maxDistanceKm = km
    ? Number(km[1])
    : hours
      ? // 4 km/h en marche tranquille, arrondi au km supérieur.
        Math.ceil((Number(hours[1]) * 4) / 1)
      : null;
  return {
    kinds: kinds.length > 0 ? kinds : ['water', 'refuge', 'summit', 'viewpoint', 'bivouac'],
    maxDistanceKm,
    easy: /\b(facile|d[ée]butant|poussette|accessible)\b/i.test(q),
    family: /\b(famille|enfants?|poussette)\b/i.test(q),
    withWater: /\b(avec|pr[èe]s d.eau|eau potable)\b/i.test(q) && /\beau\b/i.test(q),
    text: q.trim(),
  };
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

  const filters = parseQuery(parsed.data.q);
  const center = viewport
    ? { lat: viewportCenter(viewport)[1], lng: viewportCenter(viewport)[0] }
    : lat !== undefined && lng !== undefined
      ? { lat, lng }
      : null;

  try {
    if (!center) {
      return NextResponse.json({
        filters,
        results: [],
        routes: [],
        zone: viewport,
        truncated: false,
        routesTruncated: false,
        routesUnavailable: false,
      });
    }
    const dLat = 0.09;
    const dLng = 0.14;
    const searchWindow = viewport ?? {
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
        const localNetwork = route.network === 'lwn' || route.network === 'rwn';
        const matched = routeMatched(route);
        return {
          route,
          distanceKm,
          matched,
          rank:
            (matched ? 4 : 0) +
            (filters.easy && localNetwork ? 2 : 0) +
            (filters.family && localNetwork ? 1 : 0),
        };
      })
      // « 10 km » est une longueur de parcours dans une demande de randonnée.
      // Une longueur absente reste visible : elle n'est pas transformée en zéro.
      .filter(
        (candidate) =>
          filters.maxDistanceKm === null ||
          candidate.route.distance_km === null ||
          candidate.route.distance_km <= filters.maxDistanceKm,
      )
      .sort(
        (a, b) =>
          b.rank - a.rank ||
          (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
          (a.route.distance_km ?? Infinity) - (b.route.distance_km ?? Infinity),
      );
    const routes: SearchRoute[] = routeCandidates
      .slice(0, ROUTE_RESULT_LIMIT)
      .map(({ route, distanceKm, matched }) => ({
        id: route.id,
        name: route.name,
        ref: route.ref,
        network: route.network,
        distance_km: route.distance_km,
        distanceKm,
        matched,
      }));

    return NextResponse.json({
      filters,
      results,
      routes,
      zone: viewport,
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

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
