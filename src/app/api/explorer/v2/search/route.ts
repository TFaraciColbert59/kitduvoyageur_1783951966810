import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/explorer-v2/pgrest';
import {
  isSearchableViewport,
  viewportCenter,
  type SearchViewport,
} from '@/features/explorer-v2/searchArea';

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
  const hours = q.match(/(?:moins de|max(?:imum)?|sous)\s*(\d+)\s*heures?/i);
  const km = q.match(/(?:moins de|max(?:imum)?|sous)\s*(\d+)\s*km/i);
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
      return NextResponse.json({ filters, results: [], zone: viewport, truncated: false });
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
    const pois = await rpc<
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
    );

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

    return NextResponse.json({
      filters,
      results,
      zone: viewport,
      truncated: pois.length >= 80 && filtered.length > 20,
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
