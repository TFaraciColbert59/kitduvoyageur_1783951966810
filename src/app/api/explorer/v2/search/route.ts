import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/explorer-v2/pgrest';

export const revalidate = 60;

const querySchema = z.object({
  q: z.string().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
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
  });
  if (!parsed.success) return NextResponse.json({ error: 'requête invalide' }, { status: 400 });

  const filters = parseQuery(parsed.data.q);
  const lat = parsed.data.lat;
  const lng = parsed.data.lng;

  try {
    if (lat === undefined || lng === undefined) {
      return NextResponse.json({ filters, results: [] });
    }
    const dLat = 0.09;
    const dLng = 0.14;
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
        p_min_lat: lat - dLat,
        p_min_lng: lng - dLng,
        p_max_lat: lat + dLat,
        p_max_lng: lng + dLng,
        p_kinds: filters.kinds,
        p_limit: 80,
      },
      60,
    );

    const text = filters.text.toLowerCase();
    const results = pois
      .map((poi) => ({
        ...poi,
        distanceKm: haversine(lat, lng, poi.lat, poi.lon),
      }))
      .filter((poi) => (filters.maxDistanceKm ? poi.distanceKm <= filters.maxDistanceKm : true))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20)
      .map((poi) => ({
        ...poi,
        // Le nom n'est pas réécrit : on garde le libellé OSM exact.
        matched: poi.name.toLowerCase().includes(text),
      }));

    return NextResponse.json({ filters, results });
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
