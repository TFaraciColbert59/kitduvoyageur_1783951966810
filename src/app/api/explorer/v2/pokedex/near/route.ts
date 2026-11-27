import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  buildApiMeta,
  emptyFeatureCollection,
  LruCache,
  quantizeCoord,
  safeFetchJson,
  sanitizeHttpsUrl,
  type ExplorerApiMeta,
  type GeoJsonFeatureCollection,
  type GeoJsonPointFeature,
} from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 21_600_000; // 6 hours
const CACHE_CONTROL_OK = 'public, s-maxage=21600, stale-while-revalidate=43200';
const GBIF_TILE_TEMPLATE =
  'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?style=green.point&srs=EPSG:3857';

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(100).default(15),
  threatened: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

export interface PokedexSpeciesItem {
  taxonId: number;
  scientificName: string;
  commonName: string;
  iconicTaxon: string;
  kingdom: 'faune' | 'flore' | 'fungi' | 'autre';
  observationCount: number;
  photoUrl: string | null;
  threatened: boolean;
  endemic: boolean;
  wikipediaUrl: string | null;
  summary: string | null;
}

export interface PokedexNearPayload {
  species: PokedexSpeciesItem[];
  geojson: GeoJsonFeatureCollection;
  gbifTileTemplate: string;
  totalSpecies: number;
  meta: ExplorerApiMeta;
}

interface INatTaxon {
  id?: number;
  name?: string;
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  threatened?: boolean;
  endemic?: boolean;
  wikipedia_url?: string;
  default_photo?: {
    medium_url?: string;
    square_url?: string;
    url?: string;
  } | null;
}

interface INatSpeciesCountsResponse {
  total_results?: number;
  results?: Array<{
    count?: number;
    taxon?: INatTaxon;
  }>;
}

interface INatObservationsResponse {
  results?: Array<{
    id?: number;
    observed_on?: string | null;
    quality_grade?: string | null;
    place_guess?: string | null;
    obscured?: boolean;
    geojson?: { type?: string; coordinates?: number[] } | null;
    taxon?: INatTaxon | null;
    photos?: Array<{ url?: string }>;
  }>;
}

interface WikiSummaryResponse {
  extract?: string;
  content_urls?: {
    desktop?: { page?: string };
  };
}

const pokedexCache = new LruCache<Omit<PokedexNearPayload, 'meta'>>(128, 24 * 60 * 60_000);

function mapKingdom(iconic: string | undefined): PokedexSpeciesItem['kingdom'] {
  switch (iconic) {
    case 'Plantae':
      return 'flore';
    case 'Fungi':
      return 'fungi';
    case 'Mammalia':
    case 'Aves':
    case 'Reptilia':
    case 'Amphibia':
    case 'Actinopterygii':
    case 'Insecta':
    case 'Arachnida':
    case 'Mollusca':
    case 'Animalia':
      return 'faune';
    default:
      return 'autre';
  }
}

async function fetchWikiSummaryFr(title: string): Promise<{
  summary: string | null;
  url: string | null;
}> {
  const cleanTitle = title.trim().replace(/\s+/g, '_');
  if (!cleanTitle) return { summary: null, url: null };
  const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`;
  try {
    const { data } = await safeFetchJson<WikiSummaryResponse>(url, { timeoutMs: 3500 });
    return {
      summary: typeof data.extract === 'string' && data.extract.trim() ? data.extract.trim() : null,
      url: sanitizeHttpsUrl(data.content_urls?.desktop?.page),
    };
  } catch {
    return { summary: null, url: null };
  }
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-pokedex-near',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    lat: sp.get('lat'),
    lng: sp.get('lng'),
    radiusKm: sp.get('radiusKm') ?? undefined,
    threatened: sp.get('threatened') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        species: [],
        geojson: emptyFeatureCollection(),
        gbifTileTemplate: GBIF_TILE_TEMPLATE,
        totalSpecies: 0,
        meta: buildApiMeta({
          source: 'inaturalist+gbif+wikipedia',
          attribution: 'iNaturalist (CC BY-NC), GBIF (CC BY 4.0), Wikipédia (CC BY-SA)',
          stale: false,
          warning: 'Coordonnées invalides',
        }),
      },
      { status: 400 },
    );
  }

  const qLat = quantizeCoord(parsed.data.lat, 2);
  const qLng = quantizeCoord(parsed.data.lng, 2);
  const radiusKm = Math.round(parsed.data.radiusKm);
  const threatened = parsed.data.threatened;

  const cacheKey = `pokedex:${qLat.toFixed(2)},${qLng.toFixed(2)}:${radiusKm}:${threatened ? '1' : '0'}`;
  const fresh = pokedexCache.getEntry(cacheKey);
  if (fresh && !fresh.isExpired) {
    return NextResponse.json(
      {
        ...fresh.value,
        meta: buildApiMeta({
          source: 'inaturalist+gbif+wikipedia',
          attribution: 'iNaturalist (CC BY-NC), GBIF (CC BY 4.0), Wikipédia (CC BY-SA)',
          stale: false,
          fetchedAtMs: fresh.fetchedAt,
          ttlMs: CACHE_TTL_MS,
        }),
      },
      { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
    );
  }

  const countsParams = new URLSearchParams({
    lat: qLat.toFixed(2),
    lng: qLng.toFixed(2),
    radius: String(radiusKm),
    per_page: '24',
    locale: 'fr',
  });
  if (threatened) countsParams.set('threatened', 'true');

  const obsParams = new URLSearchParams({
    lat: qLat.toFixed(2),
    lng: qLng.toFixed(2),
    radius: String(radiusKm),
    geo: 'true',
    per_page: '25',
    locale: 'fr',
    order_by: 'observed_on',
  });
  if (threatened) obsParams.set('threatened', 'true');

  const [countsRes, obsRes] = await Promise.allSettled([
    safeFetchJson<INatSpeciesCountsResponse>(
      `https://api.inaturalist.org/v1/observations/species_counts?${countsParams.toString()}`,
      { timeoutMs: 3200 },
    ),
    safeFetchJson<INatObservationsResponse>(
      `https://api.inaturalist.org/v1/observations?${obsParams.toString()}`,
      { timeoutMs: 3200 },
    ),
  ]);

  if (countsRes.status === 'rejected' && obsRes.status === 'rejected') {
    const staleEntry = pokedexCache.getStale(cacheKey);
    if (staleEntry) {
      return NextResponse.json(
        {
          ...staleEntry.value,
          meta: buildApiMeta({
            source: 'inaturalist+gbif+wikipedia',
            attribution: 'iNaturalist (CC BY-NC), GBIF (CC BY 4.0), Wikipédia (CC BY-SA)',
            stale: true,
            fetchedAtMs: staleEntry.fetchedAt,
            warning: 'iNaturalist indisponible — inventaire en cache',
          }),
        },
        { status: 200, headers: { 'Cache-Control': CACHE_CONTROL_OK } },
      );
    }

    return NextResponse.json(
      {
        species: [],
        geojson: emptyFeatureCollection(),
        gbifTileTemplate: GBIF_TILE_TEMPLATE,
        totalSpecies: 0,
        meta: buildApiMeta({
          source: 'inaturalist+gbif+wikipedia',
          attribution: 'iNaturalist (CC BY-NC), GBIF (CC BY 4.0), Wikipédia (CC BY-SA)',
          stale: true,
          warning: 'Service biodiversité iNaturalist momentanément indisponible',
        }),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const species: PokedexSpeciesItem[] = [];
  let totalSpecies = 0;

  if (countsRes.status === 'fulfilled') {
    totalSpecies = countsRes.value.data.total_results ?? 0;
    for (const row of countsRes.value.data.results ?? []) {
      const t = row.taxon;
      if (!t || typeof t.id !== 'number' || !t.name) continue;
      const rawPhoto =
        t.default_photo?.medium_url ??
        t.default_photo?.square_url ??
        t.default_photo?.url ??
        null;
      species.push({
        taxonId: t.id,
        scientificName: t.name,
        commonName: t.preferred_common_name?.trim() || t.name,
        iconicTaxon: t.iconic_taxon_name ?? 'Unknown',
        kingdom: mapKingdom(t.iconic_taxon_name),
        observationCount: typeof row.count === 'number' ? row.count : 0,
        photoUrl: sanitizeHttpsUrl(rawPhoto),
        threatened: Boolean(t.threatened),
        endemic: Boolean(t.endemic),
        wikipediaUrl: sanitizeHttpsUrl(t.wikipedia_url),
        summary: null,
      });
    }
  }

  // Enrich top species with French Wikipedia summary only within a strict 280ms budget
  if (species.length > 0) {
    const top = species[0];
    const wiki = await Promise.race([
      fetchWikiSummaryFr(top.commonName || top.scientificName),
      new Promise<{ summary: string | null; url: string | null }>((resolve) =>
        setTimeout(() => resolve({ summary: null, url: null }), 280),
      ),
    ]);
    if (wiki.summary) top.summary = wiki.summary;
    if (wiki.url && !top.wikipediaUrl) top.wikipediaUrl = wiki.url;
  }

  const obsFeatures: GeoJsonPointFeature[] = [];
  if (obsRes.status === 'fulfilled') {
    for (const obs of obsRes.value.data.results ?? []) {
      const coords = obs.geojson?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const [lng, lat] = coords;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

      const rawPhoto =
        obs.photos?.[0]?.url?.replace('square.', 'medium.') ??
        obs.taxon?.default_photo?.medium_url ??
        null;

      obsFeatures.push({
        type: 'Feature',
        id: String(obs.id ?? `inat-${obsFeatures.length}`),
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: obs.id ?? null,
          taxonId: obs.taxon?.id ?? null,
          scientificName: obs.taxon?.name ?? null,
          commonName: obs.taxon?.preferred_common_name ?? obs.taxon?.name ?? 'Espèce observée',
          iconicTaxon: obs.taxon?.iconic_taxon_name ?? 'Unknown',
          kingdom: mapKingdom(obs.taxon?.iconic_taxon_name),
          observedOn: obs.observed_on ?? null,
          qualityGrade: obs.quality_grade ?? null,
          placeGuess: obs.place_guess ?? null,
          obscured: Boolean(obs.obscured),
          photoUrl: sanitizeHttpsUrl(rawPhoto),
        },
      });
    }
  }

  const payload: Omit<PokedexNearPayload, 'meta'> = {
    species,
    geojson: { type: 'FeatureCollection', features: obsFeatures },
    gbifTileTemplate: GBIF_TILE_TEMPLATE,
    totalSpecies: totalSpecies || species.length,
  };

  const saved = pokedexCache.set(cacheKey, payload, CACHE_TTL_MS);
  const warnings: string[] = [];
  if (countsRes.status === 'rejected') warnings.push('Comptage espèces indisponible');
  if (obsRes.status === 'rejected') warnings.push('Observations géolocalisées indisponibles');

  return NextResponse.json(
    {
      ...payload,
      meta: buildApiMeta({
        source: 'inaturalist+gbif+wikipedia',
        attribution: 'iNaturalist (CC BY-NC), GBIF (CC BY 4.0), Wikipédia (CC BY-SA)',
        stale: false,
        fetchedAtMs: saved.fetchedAt,
        ttlMs: CACHE_TTL_MS,
        warning: warnings.length > 0 ? warnings.join(' · ') : undefined,
      }),
    },
    { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
  );
}
